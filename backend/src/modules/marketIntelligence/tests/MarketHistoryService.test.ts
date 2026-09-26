/**
 * MarketHistoryService - change / trend annotation depth tests.
 *
 * P2.C scope:
 *   - `annotateWithChange` is the pure core of the service: it computes
 *     changePct and trendPct against previous comparable observations.
 *   - Lock down: comparability rule, change formula, trend rolling-window
 *     rule, and the "never fabricate" guarantee (null when not computable).
 *   - `getHistory` is verified by mocking MarketPriceRepository.findHistory
 *     to return a synthetic series.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {MarketHistoryService} from '../services/MarketHistoryService.js';
import type {MarketPriceRecord} from '../types.js';

// ─── helpers ────────────────────────────────────────────────────────────

function record(args: Partial<MarketPriceRecord> & {
  source: MarketPriceRecord['source'];
  state: string;
  market: string;
  commodity: string;
  arrivalDate: string;
}): MarketPriceRecord {
  return {
    recordKey: `k-${args.state}-${args.market}-${args.commodity}-${args.arrivalDate}-${args.variety ?? ''}`,
    source: args.source,
    sourceSystem: args.source === 'agmarknet' ? 'Agmarknet' : args.source === 'enam' ? 'eNAM' : 'Demo',
    commodity: args.commodity,
    crop: args.commodity,
    market: args.market,
    state: args.state,
    variety: args.variety,
    grade: args.grade,
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
    modalPrice: args.modalPrice,
    unit: '₹/quintal',
    arrivalDate: args.arrivalDate,
    ingestedAt: args.ingestedAt ?? new Date().toISOString(),
    fetchStatus: 'live',
    changePct: null,
    trendPct: null,
  };
}

// ─── pure annotateWithChange tests ──────────────────────────────────────

describe('MarketHistoryService - annotateWithChange (pure core)', () => {
  let svc: MarketHistoryService;

  beforeEach(() => {
    svc = new MarketHistoryService({} as any);
  });

  it('returns [] when given an empty input', () => {
    expect(svc.annotateWithChange([])).toEqual([]);
  });

  it('sets changePct=null on the first row (no previous comparable)', () => {
    const r = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1500,
    });
    const [out] = svc.annotateWithChange([r]);
    expect(out.changePct).toBeNull();
    expect(out.trendPct).toBeNull();
  });

  it('computes changePct vs the immediately previous comparable row', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1100,
    });
    const [out1, out2] = svc.annotateWithChange([r1, r2]);
    expect(out1.changePct).toBeNull();
    expect(out2.changePct).toBe(10); // (1100 - 1000) / 1000 * 100 = 10%
  });

  it('skips rows that are NOT comparable (different state/market/commodity/variety)', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    // Same date, different market -> NOT comparable -> changePct=null
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Bangalore Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1200,
    });
    const [out1, out2] = svc.annotateWithChange([r1, r2]);
    expect(out1.changePct).toBeNull();
    expect(out2.changePct).toBeNull();
  });

  it('treats undefined variety on both sides as a match (comparable)', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1200,
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBe(20); // (1200 - 1000) / 1000 * 100
  });

  it('treats same variety on both sides as a match (comparable)', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      variety: 'Hybrid',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      variety: 'Hybrid',
      arrivalDate: '2026-04-15',
      modalPrice: 1100,
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBe(10);
  });

  it('breaks the chain when variety differs (variety mismatch)', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      variety: 'Hybrid',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      variety: 'Local',
      arrivalDate: '2026-04-15',
      modalPrice: 1200,
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBeNull();
  });

  it('returns changePct=null when prev.modalPrice is missing (NEVER fabricate)', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      // modalPrice intentionally undefined
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1200,
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBeNull();
  });

  it('returns changePct=null when current.modalPrice is missing', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      // modalPrice intentionally undefined
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBeNull();
  });

  it('rounds changePct to 2 decimal places', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1234, // (1234-1000)/1000*100 = 23.4
    });
    const [, out2] = svc.annotateWithChange([r1, r2]);
    expect(out2.changePct).toBe(23.4);
  });

  it('computes trendPct as the mean of recent changePct values', () => {
    const records = [
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-10',
        modalPrice: 1000,
      }),
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-11',
        modalPrice: 1100,
      }),
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-12',
        modalPrice: 1210, // +10%
      }),
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-13',
        modalPrice: 1331, // +10%
      }),
    ];
    const out = svc.annotateWithChange(records);
    // Last 8 (we only have 3 valid change values): +10, +10, +10 = mean 10
    expect(out[out.length - 1].trendPct).toBe(10);
  });

  it('sorts out-of-order records by arrivalDate before annotating', () => {
    const unsorted = [
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-15',
        modalPrice: 1100,
      }),
      record({
        source: 'agmarknet',
        state: 'Karnataka',
        market: 'Kolar Mandi',
        commodity: 'Tomato',
        arrivalDate: '2026-04-14',
        modalPrice: 1000,
      }),
    ];
    const out = svc.annotateWithChange(unsorted);
    const byDate = new Map(out.map(r => [r.arrivalDate, r]));
    expect(byDate.get('2026-04-14')!.changePct).toBeNull();
    expect(byDate.get('2026-04-15')!.changePct).toBe(10);
  });

  it('does not mutate the input records', () => {
    const r1 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
    });
    const r2 = record({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
      modalPrice: 1100,
    });
    const originalR1 = JSON.parse(JSON.stringify(r1));
    const originalR2 = JSON.parse(JSON.stringify(r2));
    svc.annotateWithChange([r1, r2]);
    expect(r1).toEqual(originalR1);
    expect(r2).toEqual(originalR2);
  });
});

// ─── getHistory (with repo mock) ────────────────────────────────────────

describe('MarketHistoryService - getHistory (repo integration)', () => {
  it('returns a time-series of points with arrivalDate/modal/source', async () => {
    const repo = {
      findHistory: vi.fn(async () => [
        record({
          source: 'agmarknet',
          state: 'Karnataka',
          market: 'Kolar Mandi',
          commodity: 'Tomato',
          arrivalDate: '2026-04-14',
          modalPrice: 1000,
        }),
        record({
          source: 'agmarknet',
          state: 'Karnataka',
          market: 'Kolar Mandi',
          commodity: 'Tomato',
          arrivalDate: '2026-04-15',
          modalPrice: 1100,
        }),
      ]),
    };
    const svc = new MarketHistoryService(repo as any);
    const points = await svc.getHistory({
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
    });
    expect(repo.findHistory).toHaveBeenCalledWith({
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      lookbackDays: undefined,
    });
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      arrivalDate: '2026-04-14',
      modalPrice: 1000,
      source: 'agmarknet',
    });
    expect(points[1]).toMatchObject({
      arrivalDate: '2026-04-15',
      modalPrice: 1100,
      source: 'agmarknet',
    });
  });

  it('returns [] when the repo returns []', async () => {
    const repo = {findHistory: vi.fn(async () => [])};
    const svc = new MarketHistoryService(repo as any);
    const points = await svc.getHistory({
      state: 'Karnataka',
      market: 'X',
      commodity: 'Tomato',
    });
    expect(points).toEqual([]);
  });

  it('forwards lookbackDays to the repository', async () => {
    const repo = {findHistory: vi.fn(async () => [])};
    const svc = new MarketHistoryService(repo as any);
    await svc.getHistory({
      state: 'Karnataka',
      market: 'X',
      commodity: 'Tomato',
      lookbackDays: 14,
    });
    expect(repo.findHistory).toHaveBeenCalledWith({
      state: 'Karnataka',
      market: 'X',
      commodity: 'Tomato',
      lookbackDays: 14,
    });
  });
});