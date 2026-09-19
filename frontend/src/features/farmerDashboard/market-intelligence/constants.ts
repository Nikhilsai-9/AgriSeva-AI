/**
 * Market Intelligence — Constants & Defaults
 *
 * Pure data module. No React, no I/O.
 *
 * All weights are explicit:
 *   NET_VALUE       50
 *   DISTANCE        15
 *   DEMAND          15
 *   PAYMENT_REL     10
 *   QUALITY_MATCH   10
 *                  ----
 *                  100
 *
 * Reliability score breakdown:
 *   verifiedBonus   20
 *   ratingFactor    35
 *   dealsFactor     25
 *   paymentFactor   20
 *   disputeFactor  -20  (max penalty)
 *                  ----
 *   rawTotal       100 → clamped to [0,100]
 *
 * RULE 11: if a buyer has fewer than `MIN_DEALS_FOR_RELIABILITY`
 * completed deals the score is suppressed (returned as null) to
 * avoid over-trusting thin histories.
 */

// ──────────────────────────────────────────────────────────────────────────
// Recommendation weights
// ──────────────────────────────────────────────────────────────────────────
export const RECOMMENDATION_WEIGHTS = {
  netValue: 0.5,
  distance: 0.15,
  demand: 0.15,
  paymentReliability: 0.1,
  qualityMatch: 0.1,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Distance ceiling — buyers/markets farther than this score 0 on distance
// ──────────────────────────────────────────────────────────────────────────
export const MAX_DISTANCE_KM = 200;

// ──────────────────────────────────────────────────────────────────────────
// Reliability thresholds (RULE 11)
// ──────────────────────────────────────────────────────────────────────────
/** Below this, reliability score is suppressed (null). */
export const MIN_DEALS_FOR_RELIABILITY = 3;

// ──────────────────────────────────────────────────────────────────────────
// Logistics default cost model (per-quintal, used when no per-km rate found)
// ──────────────────────────────────────────────────────────────────────────
export const DEFAULT_LOGISTICS_COSTS = {
  /** Loading charge per kg at origin (₹). */
  loadingPerKg: 0.25,
  /** Unloading charge per kg at destination (₹). */
  unloadingPerKg: 0.25,
  /** Market fee as a fraction of gross value (e.g. 0.01 = 1%). */
  marketFeePct: 0.01,
  /** Insurance as a fraction of gross value (e.g. 0.005 = 0.5%). */
  insurancePct: 0.005,
  /** A flat 'other / sundry' cost in ₹ per lot. */
  otherFlat: 50,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Per-quintal weight in kg (mandi prices are quoted per quintal)
// ──────────────────────────────────────────────────────────────────────────
export const KG_PER_QUINTAL = 100;

// ──────────────────────────────────────────────────────────────────────────
// Reliability tier labels (for UI display)
// ──────────────────────────────────────────────────────────────────────────
export const RELIABILITY_TIERS = {
  excellent: { min: 80, max: 100, label: "Excellent" },
  good: { min: 60, max: 79, label: "Good" },
  fair: { min: 40, max: 59, label: "Fair" },
  limited: { min: 0, max: 39, label: "Limited data" },
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Source labels (for the "Source" chip on every market-price surface)
// ──────────────────────────────────────────────────────────────────────────
export const MARKET_SOURCE_LABEL = "Demo";
export const MANDI_SOURCE_LABEL = "Demo Mandi";

// ──────────────────────────────────────────────────────────────────────────
// Currency symbol used by the dashboard
// ──────────────────────────────────────────────────────────────────────────
export const RUPEE_SYMBOL = "₹";
