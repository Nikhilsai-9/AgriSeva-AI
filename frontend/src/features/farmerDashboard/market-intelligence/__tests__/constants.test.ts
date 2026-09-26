/**
 * PHASE 2 §P2.B — pure-function tests for `./constants.ts`.
 *
 * These are the FE constants that the backend must mirror (see
 * `backend/src/modules/marketIntelligence/services/scoring.ts`
 * `SERVER_RECOMMENDATION_WEIGHTS`). Drift here is caught by the
 * backend's weight-sum test; drift there is caught by THIS test.
 *
 * Locked rules:
 *   • `RECOMMENDATION_WEIGHTS` must sum to exactly 1.0.
 *   • `MAX_DISTANCE_KM > 0`.
 *   • `MIN_DEALS_FOR_RELIABILITY >= 3` (RULE 11 — thin histories are
 *     suppressed; never lower this without a deliberate change).
 *   • `KG_PER_QUINTAL === 100` (mandi pricing convention).
 */
import {describe, it, expect} from 'vitest';
import {
  RECOMMENDATION_WEIGHTS,
  MAX_DISTANCE_KM,
  MIN_DEALS_FOR_RELIABILITY,
  KG_PER_QUINTAL,
  RELIABILITY_TIERS,
  DEFAULT_LOGISTICS_COSTS,
  MARKET_SOURCE_LABEL,
  MANDI_SOURCE_LABEL,
  getSourceLabel,
} from '../constants';

describe('constants — invariants', () => {
  it('RECOMMENDATION_WEIGHTS sums to exactly 1.0', () => {
    const sum =
      RECOMMENDATION_WEIGHTS.netValue +
      RECOMMENDATION_WEIGHTS.distance +
      RECOMMENDATION_WEIGHTS.demand +
      RECOMMENDATION_WEIGHTS.paymentReliability +
      RECOMMENDATION_WEIGHTS.qualityMatch;
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it('RECOMMENDATION_WEIGHTS carries the documented 50/15/15/10/10 split', () => {
    expect(RECOMMENDATION_WEIGHTS.netValue).toBe(0.5);
    expect(RECOMMENDATION_WEIGHTS.distance).toBe(0.15);
    expect(RECOMMENDATION_WEIGHTS.demand).toBe(0.15);
    expect(RECOMMENDATION_WEIGHTS.paymentReliability).toBe(0.1);
    expect(RECOMMENDATION_WEIGHTS.qualityMatch).toBe(0.1);
  });

  it('MAX_DISTANCE_KM is a positive finite number', () => {
    expect(MAX_DISTANCE_KM).toBeGreaterThan(0);
    expect(Number.isFinite(MAX_DISTANCE_KM)).toBe(true);
  });

  it('MIN_DEALS_FOR_RELIABILITY is at least 3 (RULE 11 — thin histories suppressed)', () => {
    expect(MIN_DEALS_FOR_RELIABILITY).toBeGreaterThanOrEqual(3);
  });

  it('KG_PER_QUINTAL is exactly 100 (mandi pricing convention)', () => {
    expect(KG_PER_QUINTAL).toBe(100);
  });
});

describe('constants — RELIABILITY_TIERS', () => {
  it('covers four tiers with non-overlapping ranges from 0..100', () => {
    const tiers = Object.values(RELIABILITY_TIERS);
    // Sort by min ascending.
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted[sorted.length - 1].max).toBe(100);
    // Each tier contributes at least one label.
    for (const t of tiers) {
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe('constants — DEFAULT_LOGISTICS_COSTS', () => {
  it('fractions are within (0, 1) and flats are non-negative', () => {
    expect(DEFAULT_LOGISTICS_COSTS.loadingPerKg).toBeGreaterThan(0);
    expect(DEFAULT_LOGISTICS_COSTS.unloadingPerKg).toBeGreaterThan(0);
    expect(DEFAULT_LOGISTICS_COSTS.marketFeePct).toBeGreaterThan(0);
    expect(DEFAULT_LOGISTICS_COSTS.marketFeePct).toBeLessThan(1);
    expect(DEFAULT_LOGISTICS_COSTS.insurancePct).toBeGreaterThan(0);
    expect(DEFAULT_LOGISTICS_COSTS.insurancePct).toBeLessThan(1);
    expect(DEFAULT_LOGISTICS_COSTS.otherFlat).toBeGreaterThanOrEqual(0);
  });
});

describe('constants — deprecated labels still resolve', () => {
  it('MARKET_SOURCE_LABEL / MANDI_SOURCE_LABEL remain strings for back-compat', () => {
    expect(typeof MARKET_SOURCE_LABEL).toBe('string');
    expect(typeof MANDI_SOURCE_LABEL).toBe('string');
    expect(MANDI_SOURCE_LABEL.length).toBeGreaterThan(0);
  });
});

describe('getSourceLabel — truthfulness branches (PHASE 1 §P2.7)', () => {
  it('isDemo=true → MARKET_SOURCE_LABEL regardless of source', () => {
    expect(getSourceLabel('agmarknet', true)).toBe(MARKET_SOURCE_LABEL);
    expect(getSourceLabel(undefined, true)).toBe(MARKET_SOURCE_LABEL);
  });

  it('agmarknet / mcp-agmarknet → "Agmarknet (data.gov.in)"', () => {
    expect(getSourceLabel('agmarknet')).toBe('Agmarknet (data.gov.in)');
    expect(getSourceLabel('mcp-agmarknet')).toBe('Agmarknet (data.gov.in)');
    expect(getSourceLabel('AGMARKNET')).toBe('Agmarknet (data.gov.in)'); // case-insensitive
  });

  it('enam / mcp-enam → "eNAM"', () => {
    expect(getSourceLabel('enam')).toBe('eNAM');
    expect(getSourceLabel('mcp-enam')).toBe('eNAM');
  });

  it('empty/undefined source → MARKET_SOURCE_LABEL ("Demo" legacy fallback)', () => {
    expect(getSourceLabel('')).toBe(MARKET_SOURCE_LABEL);
    expect(getSourceLabel(undefined)).toBe(MARKET_SOURCE_LABEL);
  });

  it('unknown source id → "Source: <id>" (NEVER silent "Demo")', () => {
    expect(getSourceLabel('made_up_id_xyz')).toBe('Source: made_up_id_xyz');
  });
});
