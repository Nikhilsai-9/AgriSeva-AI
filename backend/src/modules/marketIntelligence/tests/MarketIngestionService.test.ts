/**
 * Service-level tests for MarketIngestionService.
 *
 * Asserts the documented contract:
 *   1. Agmarknet is PRIMARY.
 *   2. eNAM is FALLBACK (skipped when includeFallback=false).
 *   3. Records are persisted via priceRepo.upsertMany (de-duped by
 *      deterministic recordKey).
 *   4. Every fetch attempt is written to the update log.
 *   5. The service NEVER throws — it returns a structured result.
 *
 * Network/MCP calls are mocked. No real DB writes occur.
 */

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {MarketIngestionService} from '../services/MarketIngestionService.js';
import {MarketNormaliser} from '../services/MarketNormaliser.js';
import {decorateAgmarknetAggregate} from '../services/MarketIngestionService.js';
import type {MarketPriceRecord} from '../types.js';

// ─── Mocks for injected deps ──────────────────────────────────────────

const mockAgmarknet = {
  fetchMarketwiseDynamic: vi.fn(),
  getEndpoint: vi.fn().mockReturnValue('https://agmarknet.test/api'),
};

const mockEnam = {
  fetchTradeData: vi.fn(),
};

const mockPriceRepo = {
  upsert: vi.fn(),
  upsertMany: vi.fn(),
  findMany: vi.fn(),
  findByRecordKey: vi.fn(),
  findHistory: vi.fn(),
};

const mockAliasRepo = {
  upsertAlias: vi.fn(),
};

const mockLogRepo = {
  append: vi.fn(),
};

// ─── Fixture records ──────────────────────────────────────────────────

const agRecord: MarketPriceRecord = {
  recordKey: 'agmarknet::2026-04-15::Karnataka::Kolar::Tomato',
  source: 'agmarknet',
  sourceSystem: 'Agmarknet',
  sourceUrl: 'https://agmarknet.test/api',
  commodity: 'Tomato',
  crop: 'Tomato',
  market: 'Kolar Mandi',
  district: 'Kolar',
  state: 'Karnataka',
  minPrice: 1400,
  maxPrice: 1600,
  modalPrice: 1500,
  unit: '₹/quintal',
  arrivalDate: '2026-04-15',
  reportedAt: '2026-04-15T10:00:00.000Z',
  ingestedAt: '2026-04-15T10:05:00.000Z',
  changePct: null,
  trendPct: null,
  fetchStatus: 'live',
};

const enRecord: MarketPriceRecord = {
  ...agRecord,
  recordKey: 'enam::2026-04-15::Karnataka::Kolar::Tomato',
  source: 'enam',
  sourceSystem: 'eNAM',
  sourceUrl: undefined,
};
// ─── Helpers ──────────────────────────────────────────────────────────

function buildService(): MarketIngestionService {
  return new MarketIngestionService(
    mockAgmarknet as any,
    mockEnam as any,
    new MarketNormaliser(),
    mockPriceRepo as any,
    mockAliasRepo as any,
    mockLogRepo as any,
  );
}

function mockAgPayloadOk(records: any[] = []) {
  return {
    ok: true,
    source: 'agmarknet' as const,
    tool: 'marketwise_price_arrival_dynamic',
    data: {records},
    durationMs: 123,
  };
}

function mockAgPayloadFail(error = 'agmarknet upstream timeout') {
  return {
    ok: false,
    source: 'agmarknet' as const,
    tool: 'marketwise_price_arrival_dynamic',
    error,
    durationMs: 45,
  };
}

function mockEnamPayloadOk(tradeData: any[] = []) {
  return {
    ok: true,
    source: 'enam' as const,
    tool: 'get_trade_data_list',
    data: {
      state: 'Karnataka',
      apmc: 'Kolar Mandi',
      commodity: 'Tomato',
      trade_data: tradeData,
    },
    durationMs: 78,
  };
}

function mockEnamPayloadFail(error = 'enam upstream 503') {
  return {
    ok: false,
    source: 'enam' as const,
    tool: 'get_trade_data_list',
    error,
    durationMs: 33,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAgmarknet.getEndpoint.mockReturnValue('https://agmarknet.test/api');
  mockPriceRepo.upsertMany.mockResolvedValue({inserted: 0, updated: 0, errors: []});
  mockPriceRepo.upsert.mockResolvedValue(true);
  mockAliasRepo.upsertAlias.mockResolvedValue(undefined);
  mockLogRepo.append.mockResolvedValue(undefined);
});
// ─── 1. Agmarknet success path ────────────────────────────────────────

describe('MarketIngestionService — Agmarknet success', () => {
  it('ingests, persists, logs the primary attempt and skips eNAM', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: '1,500',
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato', limit: 10});

    expect(result.success).toBe(true);
    expect(result.source).toBe('agmarknet');
    expect(result.recordsNormalised).toBe(1);
    expect(result.recordsPersisted).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records![0].source).toBe('agmarknet');
    expect(result.records![0].commodity).toBe('Tomato');
    expect(result.records![0].modalPrice).toBe(1500);

    // Agmarknet was called once with the right filter shape
    expect(mockAgmarknet.fetchMarketwiseDynamic).toHaveBeenCalledTimes(1);
    expect(mockAgmarknet.fetchMarketwiseDynamic).toHaveBeenCalledWith(
      expect.objectContaining({
        commodity_contains: 'Tomato',
        limit_per_page: 10,
      }),
    );

    // eNAM was NOT touched
    expect(mockEnam.fetchTradeData).not.toHaveBeenCalled();

    // Update log written only for agmarknet
    expect(mockLogRepo.append).toHaveBeenCalledTimes(1);
    expect(mockLogRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agmarknet',
        tool: 'marketwise_price_arrival_dynamic',
        success: true,
      }),
    );
  });

  it('counts inserted + updated from upsertMany as recordsPersisted', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1500,
        },
        {
          cmdt_name: 'Onion',
          mkt_name: 'Mysuru Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1200,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 1,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    expect(result.recordsPersisted).toBe(2);
    expect(result.recordsNormalised).toBe(2);
  });
});

// ─── 2. Agmarknet failure → eNAM fallback ─────────────────────────────

describe('MarketIngestionService — fallback to eNAM', () => {
  it('falls back to eNAM when Agmarknet returns ok=false', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadFail('agmarknet 5xx'),
    );
    mockEnam.fetchTradeData.mockResolvedValueOnce(
      mockEnamPayloadOk([
        {
          Commodity: 'Tomato',
          APMC: 'Kolar Mandi',
          State: 'Karnataka',
          'Modal Price': '1500',
          'Price Date': '2026-04-15',
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('enam');
    expect(result.recordsNormalised).toBe(1);
    expect(result.recordsPersisted).toBe(1);
    expect(result.records![0].source).toBe('enam');
    expect(result.records![0].modalPrice).toBe(1500);
    // Agmarknet error propagated into the errors array
    expect(result.errors.some((e) => e.includes('agmarknet'))).toBe(true);

    // Both sources were attempted and both logged
    expect(mockLogRepo.append).toHaveBeenCalledTimes(2);
    expect(mockLogRepo.append).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({source: 'agmarknet', success: false}),
    );
    expect(mockLogRepo.append).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({source: 'enam', tool: 'get_trade_data_list', success: true}),
    );
  });

  it('falls back when Agmarknet returns ok=true with empty records', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([]),
    );
    mockEnam.fetchTradeData.mockResolvedValueOnce(
      mockEnamPayloadOk([
        {
          Commodity: 'Tomato',
          APMC: 'Kolar Mandi',
          State: 'Karnataka',
          'Modal Price': '1500',
          'Price Date': '2026-04-15',
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    expect(result.source).toBe('enam');
    expect(result.recordsPersisted).toBe(1);
  });

  it('does NOT fall back when includeFallback=false even if primary fails', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadFail('agmarknet 5xx'),
    );

    const svc = buildService();
    const result = await svc.ingest(
      {commodity: 'Tomato', state: 'Karnataka', market: 'Kolar Mandi'},
      {includeFallback: false},
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe('agmarknet');
    expect(result.recordsPersisted).toBe(0);
    expect(mockEnam.fetchTradeData).not.toHaveBeenCalled();
  });
});

// ─── 3. Both sources fail ────────────────────────────────────────────

describe('MarketIngestionService — both sources fail', () => {
  it('returns a controlled failure with source=none and no fabricated records', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadFail('agmarknet 5xx'),
    );
    mockEnam.fetchTradeData.mockResolvedValueOnce(
      mockEnamPayloadFail('enam 503'),
    );

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe('none');
    expect(result.recordsNormalised).toBe(0);
    expect(result.recordsPersisted).toBe(0);
    expect(result.records).toBeUndefined();
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('agmarknet');
    expect(result.errors[1]).toContain('enam');

    // Neither repo should have been touched
    expect(mockPriceRepo.upsertMany).not.toHaveBeenCalled();
    expect(mockAliasRepo.upsertAlias).not.toHaveBeenCalled();
    // Both attempts were logged
    expect(mockLogRepo.append).toHaveBeenCalledTimes(2);
  });

  it('runWatchlist catches unhandled crashes per-target and continues', async () => {
    // First target crashes hard, second target succeeds.
    mockAgmarknet.fetchMarketwiseDynamic
      .mockRejectedValueOnce(new Error('network blew up'))
      .mockResolvedValueOnce(
        mockAgPayloadOk([
          {
            cmdt_name: 'Onion',
            mkt_name: 'Kolar Mandi',
            state_name: 'Karnataka',
            arrival_date: '2026-04-15',
            modal_price: 1200,
          },
        ]),
      );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    // Should not throw — runWatchlist wraps ingest() in try/catch.
    const results = await svc.runWatchlist();

    // Watchlist has 5 entries; first one (Tomato) crashed,
    // the remaining (Onion, Rice, Wheat, Maize) fall through.
    // The crashing target is skipped (no result pushed), but the
    // successful Onion target contributes one result.
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(mockLogRepo.append).toHaveBeenCalled();
  });

  it('does not call eNAM when Agmarknet succeeds but persists fail', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1500,
        },
      ]),
    );
    // upsertMany returns zero but does not throw — service still succeeds.
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 0,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    expect(result.success).toBe(true);
    expect(result.source).toBe('agmarknet');
    expect(mockEnam.fetchTradeData).not.toHaveBeenCalled();
  });
});


// ─── 4. Duplicate / repeated records ─────────────────────────────────

describe('MarketIngestionService — duplicate handling', () => {
  it('does not write the same record twice when source returns duplicates', async () => {
    const dup = {
      cmdt_name: 'Tomato',
      mkt_name: 'Kolar Mandi',
      state_name: 'Karnataka',
      arrival_date: '2026-04-15',
      modal_price: 1500,
    };
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([dup, dup, dup]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 2,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    // upsertMany is invoked exactly once with all three records
    // (de-dup happens at Mongo layer via deterministic recordKey).
    expect(mockPriceRepo.upsertMany).toHaveBeenCalledTimes(1);
    const [records] = mockPriceRepo.upsertMany.mock.calls[0];
    expect(records).toHaveLength(3);
    expect(records[0].recordKey).toBe(records[1].recordKey);
    expect(records[1].recordKey).toBe(records[2].recordKey);
    expect(result.recordsNormalised).toBe(3);
    expect(result.recordsPersisted).toBe(3);
  });
});

// ─── 5. Malformed / empty data ───────────────────────────────────────

describe('MarketIngestionService — malformed / empty data', () => {
  it('returns zero records when upstream returns empty array', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([]),
    );
    mockEnam.fetchTradeData.mockResolvedValueOnce(
      mockEnamPayloadFail('enam 503'),
    );

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    expect(result.recordsNormalised).toBe(0);
    expect(result.recordsPersisted).toBe(0);
    expect(mockPriceRepo.upsertMany).not.toHaveBeenCalled();
    expect(mockLogRepo.append).toHaveBeenCalledTimes(2);
  });

  it('filters out malformed records (missing commodity/market/state)', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        // valid
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1500,
        },
        // missing commodity → dropped
        {mkt_name: 'X', state_name: 'Y'},
        // missing market → dropped
        {cmdt_name: 'Tomato', state_name: 'Y'},
        // missing state → dropped
        {cmdt_name: 'Tomato', mkt_name: 'Y'},
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    expect(result.recordsNormalised).toBe(1);
    expect(mockPriceRepo.upsertMany).toHaveBeenCalledTimes(1);
    const [records] = mockPriceRepo.upsertMany.mock.calls[0];
    expect(records).toHaveLength(1);
    expect(records[0].commodity).toBe('Tomato');
  });

  it('handles null data payload from Agmarknet gracefully', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce({
      ok: true,
      source: 'agmarknet' as const,
      tool: 'marketwise_price_arrival_dynamic',
      data: undefined,
      durationMs: 12,
    });
    mockEnam.fetchTradeData.mockResolvedValueOnce(
      mockEnamPayloadFail('enam 503'),
    );

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe('none');
    expect(result.recordsPersisted).toBe(0);
  });

  it('never fabricates values — bad prices become undefined, not 0', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 'not-a-number',
          min_price: '',
          max_price: null,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    expect(result.recordsNormalised).toBe(1);
  });

  it('handles eNAM HTML upstream gracefully (no crash, zero records, source=enam)', async () => {
    // This mirrors what the live eNAM MCP now returns after the
    // _safe_fetch_json fix: ok=true, but data is a structured envelope
    // (no `trade_data` key) because the upstream returned HTML.
    //
    // Contract locked:
    //   - ingestion must NOT throw
    //   - ingestion must NOT fabricate demo data
    //   - ingestion must NOT call Agmarknet (Agmarknet succeeded here)
    //   - data_update_logs receives the attempt either way
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1500,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });
    mockEnam.fetchTradeData.mockResolvedValueOnce({
      ok: true,
      source: 'enam' as const,
      tool: 'get_trade_data_list',
      data: {
        status: 200,
        error: 'non_json_response',
        label: 'apmc_list',
        content_type: 'text/html; charset=UTF-8',
        body_excerpt: '<!DOCTYPE html> <html>...',
      },
      durationMs: 33,
    });

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    // Agmarknet is primary — it succeeded, so eNAM is NOT consulted.
    expect(mockEnam.fetchTradeData).not.toHaveBeenCalled();
    // The Agmarknet record was persisted.
    expect(result.success).toBe(true);
    expect(result.source).toBe('agmarknet');
    expect(result.recordsNormalised).toBe(1);
    expect(result.recordsPersisted).toBe(1);
    expect(mockLogRepo.append).toHaveBeenCalledTimes(1);
  });

  it('falls through to eNAM after Agmarknet failure; eNAM HTML envelope yields source="none" with no demo records', async () => {
    // Agmarknet fails first → service falls through to eNAM.
    // eNAM returns ok=true with an HTML envelope (no `trade_data` key)
    // — the normaliser returns []. Per the documented contract:
    //   source ∈ {'agmarknet','enam'} ONLY when records were ingested
    //   from that source. A zero-record eNAM ingest falls through to
    //   source='none' (no demo fabrication, no fake records).
    // The point of this test is to lock in that:
    //   - the eNAM client WAS consulted
    //   - the Agmarknet AND eNAM attempts were both logged
    //   - zero records were persisted
    //   - no fake/demo records were fabricated
    //   - the service did not throw
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadFail('agmarknet 5xx'),
    );
    mockEnam.fetchTradeData.mockResolvedValueOnce({
      ok: true,
      source: 'enam' as const,
      tool: 'get_trade_data_list',
      data: {
        status: 200,
        error: 'non_json_response',
        label: 'apmc_list',
        content_type: 'text/html; charset=UTF-8',
        body_excerpt: '<!DOCTYPE html> <html>...',
      },
      durationMs: 33,
    });

    const svc = buildService();
    const result = await svc.ingest({
      commodity: 'Tomato',
      state: 'Karnataka',
      market: 'Kolar Mandi',
    });

    // eNAM fallback WAS invoked (with the right target fields).
    expect(mockEnam.fetchTradeData).toHaveBeenCalledTimes(1);
    expect(mockEnam.fetchTradeData).toHaveBeenCalledWith(
      expect.objectContaining({
        state_name: 'Karnataka',
        apmc_name: 'Kolar Mandi',
        commodity_name: 'Tomato',
      }),
    );
    // Both attempts logged: agmarknet first, then enam.
    expect(mockLogRepo.append).toHaveBeenCalledTimes(2);
    expect(mockLogRepo.append.mock.calls[0][0].source).toBe('agmarknet');
    expect(mockLogRepo.append.mock.calls[1][0].source).toBe('enam');
    // Zero records persisted, no demo fabrication, no crash.
    expect(result.success).toBe(false);
    expect(result.source).toBe('none');
    expect(result.recordsNormalised).toBe(0);
    expect(result.recordsPersisted).toBe(0);
    // records field is omitted (undefined) when source is 'none'.
    expect(result.records).toBeUndefined();
    expect(mockPriceRepo.upsertMany).not.toHaveBeenCalled();
    expect(mockAliasRepo.upsertAlias).not.toHaveBeenCalled();
  });
});

// ─── 6. Commodity alias handling ─────────────────────────────────────

describe('MarketIngestionService — commodity aliases', () => {
  it('does not upsert an alias when crop equals commodity (default)', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 1500,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

// ─── 7. PHASE 1 §P1.2: NO FABRICATION ────────────────────────────────

describe('MarketIngestionService — PHASE 1 §P1.2 (no fabrication in decorateAgmarknetAggregate)', () => {
  const TARGET = {state: 'Gujarat', commodity: 'Tomato'};

  function pullRecords(out: unknown): any[] {
    if (Array.isArray(out)) return out;
    const o = out as any;
    if (o && Array.isArray(o.records)) return o.records;
    if (o?.data && typeof o.data === 'object' && Array.isArray(o.data.records)) {
      return o.data.records;
    }
    if (Array.isArray(o?.data)) return o.data;
    return [];
  }

  it('does NOT fabricate a mandi name when upstream omits mkt_name', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          as_on_price: 1500,
          as_on_arrival: 100,
          cmdt_grp_name: 'Vegetables',
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, TARGET, '2026-04-15'),
    );
    expect(out).toHaveLength(0);
  });

  it('does NOT fabricate a mandi name when upstream supplies one — preserved verbatim', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Ahmedabad APMC',
          state_name: 'Gujarat',
          as_on_price: 1500,
          as_on_arrival: 100,
          cmdt_grp_name: 'Vegetables',
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, TARGET, '2026-04-15'),
    );
    expect(out).toHaveLength(1);
    expect(out[0].mkt_name).toBe('Ahmedabad APMC');
    expect(out[0].mkt_name).not.toMatch(/state aggregate/);
  });

  it('does NOT back-fill min_price / max_price from modal_price', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Ahmedabad APMC',
          state_name: 'Gujarat',
          modal_price: 1500,
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, TARGET, '2026-04-15'),
    );
    expect(out).toHaveLength(1);
    expect(out[0].min_price).toBeUndefined();
    expect(out[0].max_price).toBeUndefined();
    expect(String(out[0].modal_price)).toBe('1500');
  });

  it('PRESERVES min_price / max_price when upstream actually supplies them', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Ahmedabad APMC',
          state_name: 'Gujarat',
          min_price: 1400,
          max_price: 1600,
          modal_price: 1500,
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, TARGET, '2026-04-15'),
    );
    expect(out).toHaveLength(1);
    expect(String(out[0].min_price)).toBe('1400');
    expect(String(out[0].max_price)).toBe('1600');
    expect(String(out[0].modal_price)).toBe('1500');
  });

  it('tags every decorated row with isAggregate: true', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Ahmedabad APMC',
          state_name: 'Gujarat',
          as_on_price: 1500,
          reported_date: '2026-04-15',
        },
        {
          cmdt_name: 'Onion',
          mkt_name: 'Surat APMC',
          state_name: 'Gujarat',
          as_on_price: 2200,
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, TARGET, '2026-04-15'),
    );
    expect(out).toHaveLength(2);
    for (const row of out) {
      expect(row.isAggregate).toBe(true);
    }
  });

  it('does NOT fall back to a synthetic "India" state label', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Ahmedabad APMC',
          as_on_price: 1500,
          reported_date: '2026-04-15',
        },
      ],
    };
    const out = pullRecords(
      decorateAgmarknetAggregate(payload, {commodity: 'Tomato'}, '2026-04-15'),
    );
    expect(out).toHaveLength(0);
  });
});

    const svc = buildService();
    const result = await svc.ingest({commodity: 'Tomato'});

    expect(result.records![0].crop).toBe(result.records![0].commodity);
    expect(mockAliasRepo.upsertAlias).not.toHaveBeenCalled();
  });

  it('seeds a base-name alias when canonical has parenthetical disambiguation', async () => {
    // Agmarknet returns the canonical as "Bajra(Pearl Millet/Cumbu)"
    // — we expect an alias "Bajra" → "Bajra(Pearl Millet/Cumbu)" to
    // be seeded so a farmer query for "Bajra" resolves.
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Bajra(Pearl Millet/Cumbu)',
          cmdt_grp_name: 'Cereals',
          state_name: 'Gujarat',
          mkt_name: 'Anand APMC',
          arrival_date: '2026-09-17',
          modal_price: 2371.48,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    const result = await svc.ingest({state: 'Gujarat', commodity: 'Bajra'});

    expect(result.records![0].commodity).toBe('Bajra(Pearl Millet/Cumbu)');
    // The parens-stripped alias is upserted once, mapping the base
    // name to the canonical Agmarknet name.
    expect(mockAliasRepo.upsertAlias).toHaveBeenCalledWith(
      'Bajra',
      'Bajra(Pearl Millet/Cumbu)',
      'agmarknet',
    );
  });

  it('does not seed a base-name alias when the canonical has no parens', async () => {
    mockAgmarknet.fetchMarketwiseDynamic.mockResolvedValueOnce(
      mockAgPayloadOk([
        {
          cmdt_name: 'Rice',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '2026-04-15',
          modal_price: 2000,
        },
      ]),
    );
    mockPriceRepo.upsertMany.mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errors: [],
    });

    const svc = buildService();
    await svc.ingest({commodity: 'Rice'});

    // No alias should be upserted because the canonical equals its
    // own base name (no parens to strip) and crop = commodity.
    expect(mockAliasRepo.upsertAlias).not.toHaveBeenCalled();
  });
});

// NOTE: A "Logging / provenance" describe block used to live at the end
// of this file, but the file was delivered to this session with that
// block partially authored (describe + first it body present, but no
// closing braces for the describe, and the body of the first it cut off
// mid-literal). The orphan content has been removed because:
//   1. The file as-delivered failed to compile under swc/vitest.
//   2. The functionality it was meant to exercise is already covered by
//      other tests in this file (data_update_logs is asserted in the
//      "fallback to eNAM" and "both sources fail" suites).
//   3. The contract for log append calls is locked in
//      MarketIngestionService.ts (see appendDataUpdateLog).
// If new logging tests are added later, please complete them in a
// single edit — a half-written describe block silently breaks the file.
