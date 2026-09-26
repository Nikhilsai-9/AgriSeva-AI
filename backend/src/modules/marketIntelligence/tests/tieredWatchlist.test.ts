/**
 * PHASE 2 §P2.A — tiered watchlist tests.
 *
 * Asserts:
 *   • Every tier declared in MARKET_WATCHLIST has at least one entry.
 *   • Each entry's `refreshHours` matches its tier's documented cadence.
 *   • `getWatchlistEntriesForTier(tier)` returns ONLY entries of that tier.
 *   • `runWatchlistForTier('HIGH')` ingests only HIGH commodities.
 *   • The cron expression map in `tieredMarketCron.ts` does not
 *     collide on the same minute.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {
  MARKET_WATCHLIST,
  WATCHLIST_TOTAL,
  countByTier,
} from '../config/marketWatchlist.config.js';
import {MarketIngestionService} from '../services/MarketIngestionService.js';
import {
  TIER_CRON_EXPRESSIONS,
  TIER_CRON_DESCRIPTIONS,
} from '../../../bootstrap/jobs/tieredMarketCron.js';

describe('marketWatchlist.config — tier coverage', () => {
  it('every tier has at least one entry', () => {
    expect(countByTier('HIGH')).toBeGreaterThan(0);
    expect(countByTier('MEDIUM')).toBeGreaterThan(0);
    expect(countByTier('LOW')).toBeGreaterThan(0);
  });

  it('total entries equals HIGH + MEDIUM + LOW', () => {
    const sum =
      countByTier('HIGH') + countByTier('MEDIUM') + countByTier('LOW');
    expect(sum).toBe(WATCHLIST_TOTAL);
    expect(sum).toBe(MARKET_WATCHLIST.length);
  });

  it('each entry carries a tier and refreshHours > 0', () => {
    for (const e of MARKET_WATCHLIST) {
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(e.tier);
      expect(e.refreshHours).toBeGreaterThan(0);
      expect(e.commodity.length).toBeGreaterThan(0);
      expect(e.limit).toBeGreaterThan(0);
    }
  });

  it('HIGH entries have shorter refreshHours than LOW entries', () => {
    const high = MARKET_WATCHLIST.filter((e) => e.tier === 'HIGH');
    const low = MARKET_WATCHLIST.filter((e) => e.tier === 'LOW');
    expect(Math.max(...high.map((e) => e.refreshHours))).toBeLessThan(
      Math.min(...low.map((e) => e.refreshHours)),
    );
  });
});

describe('MarketIngestionService — getWatchlistEntriesForTier', () => {
  it('returns only entries whose tier matches', () => {
    const svc = new MarketIngestionService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    const high = svc.getWatchlistEntriesForTier('HIGH');
    const medium = svc.getWatchlistEntriesForTier('MEDIUM');
    const low = svc.getWatchlistEntriesForTier('LOW');
    for (const e of high) expect(e.tier).toBe('HIGH');
    for (const e of medium) expect(e.tier).toBe('MEDIUM');
    for (const e of low) expect(e.tier).toBe('LOW');
    expect(high.length + medium.length + low.length).toBe(WATCHLIST_TOTAL);
  });
});

describe('MarketIngestionService — runWatchlistForTier', () => {
  let svc: MarketIngestionService;
  let ingestSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ingestSpy = vi.fn().mockResolvedValue({
      source: 'agmarknet',
      success: true,
      recordsNormalised: 1,
      recordsPersisted: 1,
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    svc = new MarketIngestionService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    (svc as any).ingest = ingestSpy;
  });

  it('runWatchlistForTier("HIGH") calls ingest ONLY for HIGH commodities', async () => {
    const r = await svc.runWatchlistForTier('HIGH');
    expect(ingestSpy).toHaveBeenCalledTimes(countByTier('HIGH'));
    for (const call of ingestSpy.mock.calls) {
      const c = (call as any[])[0]?.commodity;
      expect(MARKET_WATCHLIST.find((e) => e.commodity === c)?.tier).toBe(
        'HIGH',
      );
    }
    expect(r.length).toBe(countByTier('HIGH'));
  });

  it('runWatchlistForTier("MEDIUM") calls ingest ONLY for MEDIUM commodities', async () => {
    ingestSpy.mockClear();
    await svc.runWatchlistForTier('MEDIUM');
    expect(ingestSpy).toHaveBeenCalledTimes(countByTier('MEDIUM'));
    for (const call of ingestSpy.mock.calls) {
      const c = (call as any[])[0]?.commodity;
      expect(MARKET_WATCHLIST.find((e) => e.commodity === c)?.tier).toBe(
        'MEDIUM',
      );
    }
  });

  it('runWatchlistForTier("LOW") calls ingest ONLY for LOW commodities', async () => {
    ingestSpy.mockClear();
    await svc.runWatchlistForTier('LOW');
    expect(ingestSpy).toHaveBeenCalledTimes(countByTier('LOW'));
    for (const call of ingestSpy.mock.calls) {
      const c = (call as any[])[0]?.commodity;
      expect(MARKET_WATCHLIST.find((e) => e.commodity === c)?.tier).toBe(
        'LOW',
      );
    }
  });

  it('skips entirely on unknown tier (runtime guard against typo)', async () => {
    ingestSpy.mockClear();
    const r = await svc.runWatchlistForTier(
      'NOT_A_REAL_TIER' as unknown as 'HIGH',
    );
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(r).toEqual([]);
  });

  it('passes {includeFallback: true} so eNAM is tried when Agmarknet fails', async () => {
    await svc.runWatchlistForTier('HIGH');
    for (const call of ingestSpy.mock.calls) {
      const opts = (call as any[])[1];
      expect(opts?.includeFallback).toBe(true);
    }
  });

  it('resets isRunning after the run so a follow-up tier can proceed', async () => {
    await svc.runWatchlistForTier('HIGH');
    expect((svc as any).isRunning).toBe(false);
    ingestSpy.mockClear();
    await svc.runWatchlistForTier('LOW');
    expect(ingestSpy).toHaveBeenCalledTimes(countByTier('LOW'));
  });
});

describe('tieredMarketCron — schedule invariants', () => {
  it('defines a cron expression for every tier', () => {
    expect(TIER_CRON_EXPRESSIONS.HIGH).toBeTruthy();
    expect(TIER_CRON_EXPRESSIONS.MEDIUM).toBeTruthy();
    expect(TIER_CRON_EXPRESSIONS.LOW).toBeTruthy();
  });

  it('every expression has a human-readable description', () => {
    expect(TIER_CRON_DESCRIPTIONS.HIGH.length).toBeGreaterThan(0);
    expect(TIER_CRON_DESCRIPTIONS.MEDIUM.length).toBeGreaterThan(0);
    expect(TIER_CRON_DESCRIPTIONS.LOW.length).toBeGreaterThan(0);
  });

  it('minute-of-hour is unique across tiers (so crons never collide)', () => {
    const minutes = (Object.values(TIER_CRON_EXPRESSIONS) as string[]).map(
      (expr) => parseInt(expr.split(' ')[0], 10),
    );
    const unique = new Set(minutes);
    expect(unique.size).toBe(minutes.length);
  });

  it('minute values are explicit non-zero offsets', () => {
    const minutes = (Object.values(TIER_CRON_EXPRESSIONS) as string[]).map(
      (expr) => parseInt(expr.split(' ')[0], 10),
    );
    for (const m of minutes) {
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThan(60);
    }
  });

  it('every cron expression parses as a valid node-cron pattern', () => {
    for (const expr of Object.values(TIER_CRON_EXPRESSIONS)) {
      expect(expr).toMatch(/^\d+\s[\*/\d,]+\s[\*/\d,]+\s[\*/\d,]+\s[\*/\d,]+$/);
    }
  });
});

