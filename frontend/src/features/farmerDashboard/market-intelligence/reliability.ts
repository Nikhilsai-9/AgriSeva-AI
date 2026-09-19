/**
 * Market Intelligence — Buyer Reliability Score
 *
 * Pure function. Computes a 0..100 reliability score for a buyer given
 * their record and any grievances filed against them. The score is
 * deliberately transparent so the UI can show why it trusts (or
 * doesn't trust) a buyer.
 *
 *   verifiedBonus   +20 (verificationStatus === "verified")
 *   ratingFactor    0..35   (rating / 5 * 35)
 *   dealsFactor     0..25   (logarithmic curve, capped at 200 deals)
 *   paymentFactor   0..20   (inversely proportional to NET-terms)
 *   disputeFactor   0..-20  (count of payment-related grievances)
 *
 *   rawTotal = 100 − disputes_penalty + others, clamped [0,100]
 *
 * RULE 11 (suppression): if `buyer.completedDeals < MIN_DEALS_FOR_RELIABILITY`
 * (default 3) the function returns `null` instead of a misleading low score.
 *
 * The companion `reliabilityEvidence` helper extracts a small set of chips
 * the UI can render in a "Why this score?" tooltip.
 */

import {
  MIN_DEALS_FOR_RELIABILITY,
  RELIABILITY_TIERS,
} from "./constants";
import type { Buyer, Grievance } from "../types";

export type ReliabilityTierKey = keyof typeof RELIABILITY_TIERS;

export interface ReliabilityEvidence {
  /** Short, human-readable chip text. */
  label: string;
  /** Positive or negative contribution signal. */
  tone: "positive" | "neutral" | "negative";
}

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, n));

function tierFor(score: number): ReliabilityTierKey {
  if (score >= RELIABILITY_TIERS.excellent.min) return "excellent";
  if (score >= RELIABILITY_TIERS.good.min) return "good";
  if (score >= RELIABILITY_TIERS.fair.min) return "fair";
  return "limited";
}

function dealsContribution(completedDeals: number): number {
  // Logarithmic: 3 → ~6.6, 10 → 12.4, 50 → 18.8, 200 → 24.6
  if (completedDeals <= 0) return 0;
  return clamp((Math.log10(1 + completedDeals) / Math.log10(1 + 200)) * 25);
}

function paymentTermsContribution(paymentTermsDays: number): number {
  // NET-1 → 20, NET-7 → ~14, NET-14 → ~8, NET-30 → 0
  return clamp(20 - Math.max(0, paymentTermsDays) * 0.6, 0, 20);
}

function disputePenalty(grievances: Grievance[], buyerId: string): number {
  const relevant = grievances.filter(
    (g) =>
      g.raisedBy === "You" ||
      // Demo grievance records don't carry buyerId; match by transactionRef
      // substring when possible, otherwise count all open grievances.
      (typeof g.transactionRef === "string" &&
        g.transactionRef.includes(buyerId)),
  );
  // 5 points per payment/quality grievance, max -20.
  const paymentOrQuality = relevant.filter(
    (g) => g.category === "payment" || g.category === "quality",
  ).length;
  return clamp(paymentOrQuality * 5, 0, 20);
}

/**
 * Compute reliability score for a buyer.
 * Returns `null` when the buyer has too few deals (RULE 11).
 */
export function computeReliabilityScore(
  buyer: Buyer,
  grievances: Grievance[] = [],
): number | null {
  if ((buyer.completedDeals ?? 0) < MIN_DEALS_FOR_RELIABILITY) {
    return null;
  }

  const verifiedBonus =
    buyer.verificationStatus === "verified" ? 20 : 0;
  const ratingFactor = clamp(((buyer.rating ?? 0) / 5) * 35);
  const dealsFactor = dealsContribution(buyer.completedDeals);
  const paymentFactor = paymentTermsContribution(
    buyer.paymentTermsDays ?? 14,
  );
  const disputePenaltyValue = disputePenalty(grievances, buyer.id);

  const raw = verifiedBonus + ratingFactor + dealsFactor + paymentFactor - disputePenaltyValue;
  return Math.round(clamp(raw, 0, 100));
}

/**
 * Companion helper: returns a label for the tier and an evidence array
 * the UI can render as chips.
 */
export function reliabilityEvidence(
  buyer: Buyer,
  grievances: Grievance[] = [],
): {
  score: number | null;
  tier: ReliabilityTierKey;
  tierLabel: string;
  evidence: ReliabilityEvidence[];
  suppressed: boolean;
} {
  const score = computeReliabilityScore(buyer, grievances);
  const suppressed = score === null;
  const effective = score ?? 0;
  const tier = suppressed ? "limited" : tierFor(effective);
  const tierLabel = suppressed
    ? "Not enough deals yet"
    : RELIABILITY_TIERS[tier].label;

  const evidence: ReliabilityEvidence[] = [];

  if (buyer.verificationStatus === "verified") {
    evidence.push({ label: "Verified by platform", tone: "positive" });
  } else {
    evidence.push({ label: "Not yet verified", tone: "neutral" });
  }

  if ((buyer.rating ?? 0) > 0) {
    evidence.push({
      label: `Rated ${buyer.rating.toFixed(1)} / 5`,
      tone: buyer.rating >= 4 ? "positive" : "neutral",
    });
  }

  evidence.push({
    label: `${buyer.completedDeals} completed deals`,
    tone: buyer.completedDeals >= MIN_DEALS_FOR_RELIABILITY ? "positive" : "neutral",
  });

  if ((buyer.paymentTermsDays ?? 0) > 0) {
    evidence.push({
      label: `NET-${buyer.paymentTermsDays} payment terms`,
      tone: buyer.paymentTermsDays <= 7 ? "positive" : "neutral",
    });
  }

  const disputeCount = grievances.filter(
    (g) =>
      g.raisedBy === "You" &&
      (g.category === "payment" || g.category === "quality"),
  ).length;
  if (disputeCount > 0) {
    evidence.push({
      label: `${disputeCount} payment/quality dispute${
        disputeCount > 1 ? "s" : ""
      } filed`,
      tone: "negative",
    });
  }

  if (suppressed) {
    evidence.push({
      label: `Reliability suppressed — fewer than ${MIN_DEALS_FOR_RELIABILITY} deals`,
      tone: "neutral",
    });
  }

  return {
    score,
    tier,
    tierLabel,
    evidence,
    suppressed,
  };
}
