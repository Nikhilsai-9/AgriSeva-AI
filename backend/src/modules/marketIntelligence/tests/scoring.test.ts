/**
 * PHASE 1 §P2.4 — Server-side scoring contract.
 */

import {describe, it, expect} from 'vitest';
import {
  scoreRow,
  scoreRows,
  isDegradedMode,
  SERVER_RECOMMENDATION_WEIGHTS,
  DEGRADED_DEFAULTS,
  MAX_DISTANCE_KM,
  type ScoreBreakdown,
} from '../services/scoring.js';
import type {MarketComparisonRow} from '../types.js';

const row = (
  market: string,
  modalPrice: number | undefined,
  overrides: Partial<MarketComparisonRow> = {},
): MarketComparisonRow => ({
  market,
  state: 'Karnataka',
  district: 'Kolar',
  commodity: 'Tomato',
  modalPrice,
  minPrice: modalPrice ? modalPrice - 100 : undefined,
  maxPrice: modalPrice ? modalPrice + 100 : undefined,
  unit: 'Rs./quintal',
  arrivalDate: '2026-04-15',
  source: 'agmarknet',
  sourceSystem: 'Agmarknet',
  ...overrides,
});

describe('PHASE 1 §P2.4 — server-side scoring', () => {
  it('weights sum to exactly 1.0 (no drift from FE)', () => {
    const sum =
      SERVER_RECOMMENDATION_WEIGHTS.netValue +
      SERVER_RECOMMENDATION_WEIGHTS.distance +
      SERVER_RECOMMENDATION_WEIGHTS.demand +
      SERVER_RECOMMENDATION_WEIGHTS.paymentReliability +
      SERVER_RECOMMENDATION_WEIGHTS.qualityMatch;
    expect(Math.round(sum * 1000) / 1000).toBe(1.0);
  });

  it('matches FE weights (50/15/15/10/10)', () => {
    expect(SERVER_RECOMMENDATION_WEIGHTS.netValue).toBe(0.5);
    expect(SERVER_RECOMMENDATION_WEIGHTS.distance).toBe(0.15);
    expect(SERVER_RECOMMENDATION_WEIGHTS.demand).toBe(0.15);
    expect(SERVER_RECOMMENDATION_WEIGHTS.paymentReliability).toBe(0.1);
    expect(SERVER_RECOMMENDATION_WEIGHTS.qualityMatch).toBe(0.1);
  });

  it('MAX_DISTANCE_KM mirrors FE = 200', () => {
    expect(MAX_DISTANCE_KM).toBe(200);
  });

  it('DEGRADED_DEFAULTS match FE "buyer === null" fallbacks', () => {
    expect(DEGRADED_DEFAULTS.distance).toBe(50);
    expect(DEGRADED_DEFAULTS.demand).toBe(30);
    expect(DEGRADED_DEFAULTS.paymentReliability).toBe(30);
    expect(DEGRADED_DEFAULTS.qualityMatch).toBe(60);
  });

  it('isDegradedMode() returns true (server endpoint has no lot/buyer context)', () => {
    expect(isDegradedMode()).toBe(true);
  });

  it('scoreRow uses neutral defaults for non-numeric factors', () => {
    const r = row('Kolar Mandi', 1500);
    const out = scoreRow(r, 1500);
    expect(out.breakdown.distance).toBe(DEGRADED_DEFAULTS.distance);
    expect(out.breakdown.demand).toBe(DEGRADED_DEFAULTS.demand);
    expect(out.breakdown.paymentReliability).toBe(
      DEGRADED_DEFAULTS.paymentReliability,
    );
    expect(out.breakdown.qualityMatch).toBe(DEGRADED_DEFAULTS.qualityMatch);
  });

  it('netValue is 100 when row equals the max in the set', () => {
    const r = row('Kolar Mandi', 1500);
    const out = scoreRow(r, 1500);
    expect(out.breakdown.netValue).toBe(100);
  });

  it('netValue is 0 when row has no modalPrice', () => {
    const r = row('Unknown Mandi', undefined);
    const out = scoreRow(r, 1500);
    expect(out.breakdown.netValue).toBe(0);
  });

  it('scoreRows sorts highest-first by weighted score', () => {
    const rows = [
      row('Cheap Mandi', 1000),
      row('Premium Mandi', 2500),
      row('Mid Mandi', 1750),
    ];
    const scored = scoreRows(rows);
    expect(scored.length).toBe(3);
    expect(scored[0].row.market).toBe('Premium Mandi');
    expect(scored[1].row.market).toBe('Mid Mandi');
    expect(scored[2].row.market).toBe('Cheap Mandi');
  });

  it('scoreRows returns empty array on empty input', () => {
    expect(scoreRows([])).toEqual([]);
  });

  it('every score and breakdown is between 0 and 100 inclusive', () => {
    const rows = [
      row('Mandi A', 100),
      row('Mandi B', 1500),
      row('Mandi C', 8000),
      row('Mandi D', undefined),
    ];
    const scored = scoreRows(rows);
    for (const s of scored) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      const bd = s.breakdown as ScoreBreakdown;
      expect(bd.netValue).toBeGreaterThanOrEqual(0);
      expect(bd.netValue).toBeLessThanOrEqual(100);
      expect(bd.distance).toBeGreaterThanOrEqual(0);
      expect(bd.distance).toBeLessThanOrEqual(100);
    }
  });

  it('every reason list has at most 4 entries', () => {
    const rows = [row('Mandi A', 1500), row('Mandi B', 1700)];
    for (const s of scoreRows(rows)) {
      expect(s.reasons.length).toBeLessThanOrEqual(4);
    }
  });

  it('reasons mention "not factored" for the degraded factors', () => {
    const rows = [row('Mandi A', 1500)];
    const reasons = scoreRows(rows)[0].reasons.join(' ');
    expect(reasons).toMatch(/not factored/i);
  });
});

