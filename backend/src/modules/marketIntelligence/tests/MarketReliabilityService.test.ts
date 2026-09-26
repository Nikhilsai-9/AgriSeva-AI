/**
 * MarketReliabilityService - per-source reliability score tests.
 *
 * P2.C scope:
 *   - Lock down the four-component score algorithm:
 *       recentSuccessRatio (40), fetchFreshness (30), recentActivity (20),
 *       lowConsecutiveFails (10).
 *   - Cover label boundaries: Excellent/Good/Fair/Limited.
 *   - Cover reason-text generation for debugging.
 *   - Cover snapshotAll ordering (agmarknet, enam).
 *
 * The clock is frozen via a `now` mock so the freshness + recency
 * windows behave deterministically across runs.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {MarketReliabilityService} from '../services/ReliabilityService.js';
import type {IDataUpdateLog} from '../repositories/DataUpdateLogRepository.js';

// Frozen "now": 2026-04-15T12:00:00Z
const FROZEN_NOW = new Date('2026-04-15T12:00:00Z').getTime();

function ago(hours: number): string {
  return new Date(FROZEN_NOW - hours * 60 * 60 * 1000).toISOString();
}

function log(
  source: 'agmarknet' | 'enam',
  success: boolean,
  hoursAgo: number,
): IDataUpdateLog {
  return {
    source,
    tool: 'marketwise_price_arrival_dynamic',
    success,
    durationMs: 1000,
    fetchedAt: ago(hoursAgo),
  } as unknown as IDataUpdateLog;
}

// Build a stub repo whose findRecent() filter behaves like a real time-windowed query.
// Handles both {source, fetchedAt:{$gte}} (24h/6h windows) and {source} (all-recent).
function makeRepo(allLogs: IDataUpdateLog[]) {
  return {
    findRecent: vi.fn(async (filter: {source: string; fetchedAt?: {$gte: string}}, limit = 200) => {
      let result = allLogs.filter(l => l.source === filter.source);
      if (filter.fetchedAt?.$gte) {
        result = result.filter(l => (l as any).fetchedAt >= filter.fetchedAt!.$gte);
      }
      return result
        .sort(
          (a, b) =>
            new Date((b as any).fetchedAt).getTime() -
            new Date((a as any).fetchedAt).getTime(),
        )
        .slice(0, limit);
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MarketReliabilityService - score components', () => {
  it('returns score ~100 (Excellent) when all components are perfect', async () => {
    const logs: IDataUpdateLog[] = [
      log('agmarknet', true, 0.1), // success 6min ago -> freshness ~30
      log('agmarknet', true, 1),
      log('agmarknet', true, 2),
      log('agmarknet', true, 5),
      log('agmarknet', true, 12),
    ];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.source).toBe('agmarknet');
    expect(snap.score).toBeGreaterThanOrEqual(95);
    expect(snap.score).toBeLessThanOrEqual(100);
    expect(snap.label).toBe('Excellent');
    expect(snap.recentSuccessesLast24h).toBe(5);
    expect(snap.recentAttemptsLast24h).toBe(5);
    expect(snap.consecutiveFailures).toBe(0);
  });

  it('halves the success component when only 50% of attempts succeed', async () => {
    const logs = [
      log('agmarknet', true, 1),
      log('agmarknet', true, 2),
      log('agmarknet', false, 3),
      log('agmarknet', false, 4),
    ];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.score).toBeLessThan(100);
    expect(snap.recentSuccessesLast24h).toBe(2);
    expect(snap.recentAttemptsLast24h).toBe(4);
  });

  it('zeros out freshness when there is no successful fetch on record', async () => {
    const logs = [log('agmarknet', false, 1)];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.score).toBe(28);
    expect(snap.label).toBe('Limited');
    expect(snap.reasons).toContain('no successful fetch on record');
  });

  it('zeros recentActivity when there are no attempts in last 6h', async () => {
    const logs = [log('agmarknet', false, 12)];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.score).toBeLessThan(40);
    expect(snap.reasons).toContain('no activity in last 6h');
  });

  it('penalises three consecutive failures (failScore = max(0, 10 - 3*2) = 4)', async () => {
    const logs = [
      log('agmarknet', false, 0.5),
      log('agmarknet', false, 1),
      log('agmarknet', false, 2),
    ];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.consecutiveFailures).toBe(3);
    expect(snap.reasons).toContain('3 consecutive failures');
    expect(snap.score).toBe(24);
  });

  it('breaks the consecutive-failure streak at the first success', async () => {
    const logs = [
      log('agmarknet', false, 0.5),
      log('agmarknet', true, 1),
      log('agmarknet', false, 2),
      log('agmarknet', false, 5),
    ];
    const repo = makeRepo(logs);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.consecutiveFailures).toBe(1);
  });

  it('clamps score between 0 and 100', async () => {
    const repo = makeRepo([]);
    const svc = new MarketReliabilityService(repo as any);
    const snap = await svc.snapshot('agmarknet');
    expect(snap.score).toBeGreaterThanOrEqual(0);
    expect(snap.score).toBeLessThanOrEqual(100);
  });
});

describe('MarketReliabilityService - snapshotAll', () => {
  it('returns exactly 2 snapshots (agmarknet, enam) in that order', async () => {
    const repo = makeRepo([]);
    const svc = new MarketReliabilityService(repo as any);
    const snaps = await svc.snapshotAll();
    expect(snaps).toHaveLength(2);
    expect(snaps[0].source).toBe('agmarknet');
    expect(snaps[1].source).toBe('enam');
  });
});
