/**
 * Market Intelligence — Barrel Export
 *
 * Public surface for the new farmer-dashboard decision-support features.
 * Import from `@/features/farmerDashboard/market-intelligence` only;
 * the internal module files are not part of the contract.
 */

export {
  RECOMMENDATION_WEIGHTS,
  MAX_DISTANCE_KM,
  MIN_DEALS_FOR_RELIABILITY,
  DEFAULT_LOGISTICS_COSTS,
  KG_PER_QUINTAL,
  RELIABILITY_TIERS,
  MARKET_SOURCE_LABEL,
  MANDI_SOURCE_LABEL,
  getSourceLabel,
  RUPEE_SYMBOL,
} from "./constants";

export type {
  LogisticsEstimate,
  RealisableValue,
} from "./realisable-value";

export {
  computeRealisableValue,
  realisableValueLines,
} from "./realisable-value";

export type {
  MarketCandidate,
  RecommendBestMarketInput,
} from "./recommendation";

export {
  recommendBestMarketForLot,
  sourceLabel,
} from "./recommendation";

export type {
  ReliabilityTierKey,
  ReliabilityEvidence,
} from "./reliability";

export {
  computeReliabilityScore,
  reliabilityEvidence,
} from "./reliability";
