/**
 * Server-side 5-factor market scoring.
 *
 * PHASE 1 §P2.4 — port of the FE `recommendBestMarketForLot` scoring
 * engine. The FE engine takes a `FarmerLot` + `Buyer[]` + `Grievance[]`
 * (FE-only domain objects) and produces a weighted 0..100 score. The
 * server endpoint `GET /market-comparison` has none of those — only
 * `commodity` + `state` + `limit` — so this module DEGRADES gracefully
 * and only computes the factors for which we have data:
 *
 *   netValue            50% — full (from modalPrice; no logistics
 *                              adjustment because server has no
 *                              `FarmerLot.quantityKg`)
 *   distance            15% — DEGRADED to neutral 50 (no farmer
 *                              location)
 *   demand              15% — DEGRADED to neutral 30 (no Buyer dir)
 *   paymentReliability  10% — DEGRADED to neutral 30 (no Buyer dir)
 *   qualityMatch        10% — DEGRADED to neutral 60 (no Buyer dir)
 *
 * Weight totals = 100% — must stay in sync with the FE constants
 * (see `frontend/src/features/farmerDashboard/market-intelligence/
 * constants.ts` `RECOMMENDATION_WEIGHTS`). Any change here MUST be
 * mirrored there. PHASE 1 §P2.4 STOP-condition: do not allow drift.
 */

import type {MarketComparisonRow} from '../types.js';

/** Server-side weights — mirror of FE `RECOMMENDATION_WEIGHTS`. */
export const SERVER_RECOMMENDATION_WEIGHTS = {
  netValue: 0.5,
  distance: 0.15,
  demand: 0.15,
  paymentReliability: 0.1,
  qualityMatch: 0.1,
} as const;

/** Distance ceiling — must mirror FE `MAX_DISTANCE_KM`. */
export const MAX_DISTANCE_KM = 200;

/** Neutral-default sub-scores when context is absent on the server. */
export const DEGRADED_DEFAULTS = {
  distance: 50,
  demand: 30,
  paymentReliability: 30,
  qualityMatch: 60,
} as const;

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, n));

/** 0..100 sub-score breakdown for a single mandi. */
export interface ScoreBreakdown {
  netValue: number;
  distance: number;
  demand: number;
  paymentReliability: number;
  qualityMatch: number;
}

/** A scored mandi row. */
export interface ScoredRow {
  row: MarketComparisonRow;
  /** 0..100 weighted score. */
  score: number;
  /** 0..100 sub-scores per factor. */
  breakdown: ScoreBreakdown;
  /** Top 4 reasons ordered by raw contribution to the score. */
  reasons: string[];
}


/**
 * Compute the weighted score for one row, given the max net value
 * across the comparison set (used to normalise `netValue`).
 */
export function scoreRow(
  row: MarketComparisonRow,
  maxNetValue: number,
): ScoredRow {
  // netValue: modalPrice normalised against the best in the set.
  const netValueScore =
    maxNetValue > 0 && typeof row.modalPrice === 'number'
      ? clamp((row.modalPrice / maxNetValue) * 100, 0, 100)
      : 0;

  const breakdown: ScoreBreakdown = {
    netValue: netValueScore,
    distance: DEGRADED_DEFAULTS.distance,
    demand: DEGRADED_DEFAULTS.demand,
    paymentReliability: DEGRADED_DEFAULTS.paymentReliability,
    qualityMatch: DEGRADED_DEFAULTS.qualityMatch,
  };

  const score = clamp(
    breakdown.netValue * SERVER_RECOMMENDATION_WEIGHTS.netValue +
      breakdown.distance * SERVER_RECOMMENDATION_WEIGHTS.distance +
      breakdown.demand * SERVER_RECOMMENDATION_WEIGHTS.demand +
      breakdown.paymentReliability *
        SERVER_RECOMMENDATION_WEIGHTS.paymentReliability +
      breakdown.qualityMatch * SERVER_RECOMMENDATION_WEIGHTS.qualityMatch,
  );

  // Deterministic reasons ordered by raw contribution to the score.
  const reasonPool: Array<{impact: number; text: string}> = [
    {
      impact:
        breakdown.netValue * SERVER_RECOMMENDATION_WEIGHTS.netValue,
      text:
        typeof row.modalPrice === 'number'
          ? `Modal price Rs.${row.modalPrice}/${row.unit} (latest observation)`
          : 'No modal price reported — cannot rank net value',
    },
    {
      impact:
        breakdown.distance * SERVER_RECOMMENDATION_WEIGHTS.distance,
      text: 'Distance not factored (no farmer location provided)',
    },
    {
      impact: breakdown.demand * SERVER_RECOMMENDATION_WEIGHTS.demand,
      text: 'Demand signal not factored (no buyer directory provided)',
    },
    {
      impact:
        breakdown.paymentReliability *
        SERVER_RECOMMENDATION_WEIGHTS.paymentReliability,
      text: 'Payment reliability not factored (no buyer directory)',
    },
    {
      impact:
        breakdown.qualityMatch * SERVER_RECOMMENDATION_WEIGHTS.qualityMatch,
      text: 'Quality-match not factored (no buyer directory)',
    },
  ];

  const reasons = reasonPool
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4)
    .map(r => r.text);

  return {
    row,
    score: Math.round(score * 10) / 10,
    breakdown: {
      netValue: Math.round(breakdown.netValue),
      distance: breakdown.distance,
      demand: breakdown.demand,
      paymentReliability: breakdown.paymentReliability,
      qualityMatch: breakdown.qualityMatch,
    },
    reasons,
  };
}

/**
 * Score an entire set of mandi rows. Returns them sorted highest-first.
 */
export function scoreRows(rows: MarketComparisonRow[]): ScoredRow[] {
  if (rows.length === 0) return [];
  const maxNetValue = rows.reduce((m, r) => {
    return typeof r.modalPrice === 'number' && r.modalPrice > m
      ? r.modalPrice
      : m;
  }, 0);
  return rows
    .map(r => scoreRow(r, maxNetValue))
    .sort((a, b) => b.score - a.score);
}

/** Whether the engine is operating in degraded (no lot/buyer) mode. */
export function isDegradedMode(): boolean {
  // The server endpoint never receives FarmerLot/Buyer/Grievance, so
  // it is ALWAYS in degraded mode today. When we later accept these
  // via a richer query, this function returns false when supplied.
  return true;
}

