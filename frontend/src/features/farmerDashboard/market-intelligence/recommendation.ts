/**
 * Market Intelligence — Best-Market Recommendation
 *
 * Pure function. Scores each mandi against a farmer's lot using 5
 * weighted factors and returns the top recommendation plus a short
 * list of human-readable reasons explaining why it won.
 *
 * Score weights (sum to 100%):
 *   netValue             50% — higher net realisable is better
 *   distance             15% — closer mandis score higher
 *   demand               15% — buyers wanting this crop & quantity
 *   paymentReliability   10% — shorter NET-terms or high reliability
 *   qualityMatch         10% — buyer's grade preference vs lot.grade
 *
 * Each sub-score is normalised to 0..100. The final score is the
 * weighted sum. The top result's `reasons` array contains the top 4
 * contributors (in descending order of impact).
 */

import {
  RECOMMENDATION_WEIGHTS,
  MAX_DISTANCE_KM,
  MANDI_SOURCE_LABEL,
} from "./constants";
import {
  computeRealisableValue,
  type LogisticsEstimate,
} from "./realisable-value";
import { computeReliabilityScore } from "./reliability";
import type {
  Buyer,
  FarmerLot,
  Grievance,
  MarketPrice,
} from "../types";

export interface MarketCandidate {
  price: MarketPrice;
  /** Optional preferred buyer for this mandi. */
  buyer: Buyer | null;
  /** Realisable value computed for this (lot, mandi) pair. */
  realisable: ReturnType<typeof computeRealisableValue>;
  /** 0..100 weighted score. */
  score: number;
  /** 0..100 sub-scores, exposed for explainability. */
  breakdown: {
    netValue: number;
    distance: number;
    demand: number;
    paymentReliability: number;
    qualityMatch: number;
  };
  /** Top 4 reasons ordered by impact (highest first). */
  reasons: string[];
}

export interface RecommendBestMarketInput {
  lot: FarmerLot;
  /** Available mandi prices for this lot's crop. */
  prices: MarketPrice[];
  /** Optional buyer directory for demand/payment signals. */
  buyers?: Buyer[];
  /** Optional grievances affecting buyer reliability. */
  grievances?: Grievance[];
  /** Per-km transport rate (₹). */
  costPerKm?: number;
  /** Override for any logistics sub-cost. */
  logistics?: Partial<LogisticsEstimate>;
}

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, n));

function bestBuyerForMarket(
  _marketPrice: MarketPrice,
  lot: FarmerLot,
  buyers: Buyer[] | undefined,
): Buyer | null {
  if (!buyers || buyers.length === 0) return null;
  const cropLc = lot.crop.toLowerCase();
  const matching = buyers.filter((b) =>
    b.cropsInterested.some((c) => c.toLowerCase() === cropLc),
  );
  const pool = matching.length > 0 ? matching : buyers;
  return [...pool].sort(
    (a, b) =>
      (a.distanceKm ?? MAX_DISTANCE_KM) - (b.distanceKm ?? MAX_DISTANCE_KM),
  )[0];
}

function quantityDemandScore(buyer: Buyer | null, lot: FarmerLot): number {
  if (!buyer) return 30;
  const min = buyer.minQuantityKg ?? 0;
  const max = buyer.maxQuantityKg ?? Infinity;
  if (lot.quantityKg >= min && lot.quantityKg <= max) return 100;
  if (lot.quantityKg < min) return clamp(100 - (min - lot.quantityKg) * 0.05);
  return clamp(100 - (lot.quantityKg - max) * 0.05);
}

function paymentReliabilityScore(
  buyer: Buyer | null,
  reliability: number | null,
): number {
  if (!buyer) return 30;
  const reliabilityComponent = reliability ?? 60;
  const termsScore = clamp(100 - (buyer.paymentTermsDays ?? 14) * 2);
  return clamp(reliabilityComponent * 0.5 + termsScore * 0.5);
}

function qualityMatchScore(buyer: Buyer | null, lot: FarmerLot): number {
  if (!buyer) return 60;
  const gradeMap: Record<string, number> = { A: 100, B: 75, C: 50 };
  const lotScore = gradeMap[lot.qualityGrade] ?? 50;
  const buyerBase = buyer.verificationStatus === "verified" ? 100 : 60;
  return clamp(Math.round((buyerBase + lotScore) / 2));
}

function distanceScore(km: number): number {
  return clamp(100 - (km / MAX_DISTANCE_KM) * 100, 0, 100);
}

function netValueScore(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0;
  return clamp((value / maxValue) * 100, 0, 100);
}

const fmtRupeesShort = (n: number): string => {
  if (n >= 1_00_000) return `Rs.${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}k`;
  return `Rs.${Math.round(n)}`;
};

/**
 * Recommend the best mandi for selling `lot` given the available prices.
 * Pure, deterministic. Returns the highest-scoring candidate plus the
 * full sorted list (callers decide how many to render).
 */
export function recommendBestMarketForLot({
  lot,
  prices,
  buyers,
  grievances,
  costPerKm,
  logistics,
}: RecommendBestMarketInput): MarketCandidate[] {
  const filtered = prices.filter(
    (p) => p.commodity.toLowerCase() === lot.crop.toLowerCase(),
  );
  if (filtered.length === 0) return [];

  // First pass: compute realisable for every candidate so we know the max.
  const realisables = filtered.map((price) => {
    const buyer = bestBuyerForMarket(price, lot, buyers);
    const distanceKm = price.distanceKm ?? 0;
    const rv = computeRealisableValue({
      lot,
      price,
      logistics: {
        distanceKm,
        costPerKm: costPerKm ?? logistics?.costPerKm ?? 0,
        ...logistics,
      },
    });
    return { price, buyer, rv };
  });

  const maxNet = Math.max(...realisables.map((r) => r.rv.net), 0);

  // Second pass: compute weighted score.
  const candidates: MarketCandidate[] = realisables.map(
    ({ price, buyer, rv }) => {
      const reliability = buyer
        ? computeReliabilityScore(buyer, grievances ?? [])
        : null;

      const breakdown = {
        netValue: netValueScore(rv.net, maxNet),
        distance: distanceScore(price.distanceKm ?? 0),
        demand: quantityDemandScore(buyer, lot),
        paymentReliability: paymentReliabilityScore(buyer, reliability),
        qualityMatch: qualityMatchScore(buyer, lot),
      };

      const score = clamp(
        breakdown.netValue * RECOMMENDATION_WEIGHTS.netValue +
          breakdown.distance * RECOMMENDATION_WEIGHTS.distance +
          breakdown.demand * RECOMMENDATION_WEIGHTS.demand +
          breakdown.paymentReliability *
            RECOMMENDATION_WEIGHTS.paymentReliability +
          breakdown.qualityMatch * RECOMMENDATION_WEIGHTS.qualityMatch,
      );

      // Build reason strings (top 4 by raw contribution).
      const reasonPool: Array<{ impact: number; text: string }> = [
        {
          impact: breakdown.netValue * RECOMMENDATION_WEIGHTS.netValue,
          text: `Net realisable ${fmtRupeesShort(rv.net)} after transport & fees`,
        },
        {
          impact: breakdown.distance * RECOMMENDATION_WEIGHTS.distance,
          text: `Only ${price.distanceKm ?? 0} km from your village — low transport cost`,
        },
        {
          impact: breakdown.demand * RECOMMENDATION_WEIGHTS.demand,
          text: buyer
            ? `${buyer.name} is actively buying ${lot.crop} in your quantity range`
            : `Strong active demand for ${lot.crop} at this market`,
        },
        {
          impact:
            breakdown.paymentReliability *
            RECOMMENDATION_WEIGHTS.paymentReliability,
          text: buyer
            ? `Payment terms NET-${buyer.paymentTermsDays ?? "?"} with ${(
                reliability ?? 60
              ).toFixed(0)}% reliability`
            : `Reliable payment cycle at this market`,
        },
        {
          impact: breakdown.qualityMatch * RECOMMENDATION_WEIGHTS.qualityMatch,
          text: buyer
            ? `${buyer.name} prefers Grade ${lot.qualityGrade} produce`
            : `Your Grade ${lot.qualityGrade} lots command premium prices here`,
        },
      ];

      const reasons = reasonPool
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 4)
        .map((r) => r.text);

      return {
        price,
        buyer,
        realisable: rv,
        score: Math.round(score),
        breakdown: {
          netValue: Math.round(breakdown.netValue),
          distance: Math.round(breakdown.distance),
          demand: Math.round(breakdown.demand),
          paymentReliability: Math.round(breakdown.paymentReliability),
          qualityMatch: Math.round(breakdown.qualityMatch),
        },
        reasons,
      };
    },
  );

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Helper: a human-readable "Source" chip label.
 * Today every UI surface shows `MANDI_SOURCE_LABEL` ("Demo") because
 * the data is demo; once the MCP server is wired up this will switch
 * to `price.source` (e.g. "data.gov.in").
 */
export function sourceLabel(price: MarketPrice | undefined): string {
  // Today every mandi price in the demo is sourced from `MANDI_SOURCE_LABEL`.
  // Once the MCP server is wired up, this can branch on a per-price flag
  // (e.g. `price.sourceOverride`) to show "data.gov.in" etc.
  void price;
  return MANDI_SOURCE_LABEL;
}
