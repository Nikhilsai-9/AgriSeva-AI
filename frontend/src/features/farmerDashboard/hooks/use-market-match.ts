/**
 * Demo Matching Engine.
 *
 * Given a farmer's lot and the demo buyer directory, score each buyer
 * using a transparent, deterministic formula. Returns sorted candidates
 * for the UI to render with the explainability badge.
 *
 * Score breakdown:
 *   - cropMatch      (40%)   exact crop listed vs Lot crop
 *   - quantityFit    (20%)   how close lot.quantityKg sits in [min,max]
 *   - qualityFit     (20%)   rank grade A > B > C vs required standards
 *   - locationProximity (20%) closer buyers score higher
 */

import type { Buyer } from "../types";
import type { FarmerLot } from "../types";

export interface MatchScore {
  buyer: Buyer;
  score: number; // 0..100
  breakdown: {
    cropMatch: number;
    quantityFit: number;
    qualityFit: number;
    locationProximity: number;
  };
}

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, n));

export function scoreBuyersForLot(
  lot: FarmerLot,
  buyers: Buyer[]
): MatchScore[] {
  const results: MatchScore[] = buyers.map((buyer) => {
    const cropMatch = buyer.cropsInterested.some(
      (c) => c.toLowerCase() === lot.crop.toLowerCase()
    )
      ? 100
      : buyer.cropsInterested.some((c) =>
          lot.crop.toLowerCase().includes(c.toLowerCase())
        )
        ? 60
        : 20;

    const qMin = buyer.minQuantityKg || 0;
    const qMax = buyer.maxQuantityKg || Infinity;
    let quantityFit: number;
    if (lot.quantityKg >= qMin && lot.quantityKg <= qMax) {
      quantityFit = 100;
    } else if (lot.quantityKg < qMin) {
      quantityFit = clamp(100 - (qMin - lot.quantityKg) * 0.05);
    } else {
      quantityFit = clamp(100 - (lot.quantityKg - qMax) * 0.05);
    }

    // Verified buyers and grade A lots get the highest quality scores.
    const qualityLookup: Record<string, number> = { A: 100, B: 75, C: 50 };
    const buyerBase = buyer.verificationStatus === "verified" ? 100 : 60;
    const lotScore = qualityLookup[lot.qualityGrade] ?? 50;
    const qualityFit = Math.round((buyerBase + lotScore) / 2);

    // Closer buyers score higher, with 200km as the distance ceiling.
    const distance = buyer.distanceKm ?? 200;
    const locationProximity = clamp(
      100 - (distance / 200) * 100,
      0,
      100
    );

    const score =
      cropMatch * 0.4 +
      quantityFit * 0.2 +
      qualityFit * 0.2 +
      locationProximity * 0.2;

    return {
      buyer,
      score: Math.round(score),
      breakdown: {
        cropMatch: Math.round(cropMatch),
        quantityFit: Math.round(quantityFit),
        qualityFit: Math.round(qualityFit),
        locationProximity: Math.round(locationProximity),
      },
    };
  });

  return results.sort((a, b) => b.score - a.score);
}
