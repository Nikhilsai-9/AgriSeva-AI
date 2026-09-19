/**
 * Market Intelligence — Realisable Value Calculator
 *
 * Pure function. Given a farmer's lot, a destination mandi price and the
 * estimated logistics to reach it, computes how much the farmer actually
 * realises after deducting transport, loading, unloading, market fee,
 * insurance and a flat 'other' cost.
 *
 * Formula:
 *   gross     = (modalPrice/quintal) * (lot.quantityKg / 100)
 *             = modalPricePerKg * lot.quantityKg
 *   transport = distanceKm * costPerKm      (0 if not provided)
 *   loading   = loadingPerKg   * lot.quantityKg
 *   unloading = unloadingPerKg * lot.quantityKg
 *   marketFee = marketFeePct   * gross
 *   insurance = insurancePct   * gross
 *   other     = otherFlat
 *
 *   realisable = gross − (transport + loading + unloading
 *                          + marketFee + insurance + other)
 *
 * Returned breakdown lets the UI explain every rupee taken off.
 */

import {
  DEFAULT_LOGISTICS_COSTS,
  KG_PER_QUINTAL,
} from "./constants";
import type { FarmerLot, MarketPrice } from "../types";

export interface LogisticsEstimate {
  /** Distance from farm to the mandi in km. */
  distanceKm: number;
  /** Transport rate per km in ₹ (e.g. Krishi Roadways 38 ₹/km). */
  costPerKm?: number;
  /** Override loading charge ₹/kg. */
  loadingPerKg?: number;
  /** Override unloading charge ₹/kg. */
  unloadingPerKg?: number;
  /** Override market fee fraction (0..1). */
  marketFeePct?: number;
  /** Override insurance fraction (0..1). */
  insurancePct?: number;
  /** Override other/flat cost in ₹. */
  otherFlat?: number;
}

export interface RealisableValue {
  /** The mandi price used (modal price converted to per-kg). */
  pricePerKg: number;
  /** The mandi this is computed for. */
  marketName: string;
  /** Lot quantity in kg. */
  quantityKg: number;
  /** Total gross revenue in ₹. */
  gross: number;
  /** Deductions and their values in ₹. */
  breakdown: {
    transport: number;
    loading: number;
    unloading: number;
    marketFee: number;
    insurance: number;
    other: number;
    total: number;
  };
  /** Net amount the farmer takes home in ₹. */
  net: number;
  /** Convenience: net per kg in ₹. */
  netPerKg: number;
  /** Always true in this build — distinguishes demo flag. */
  isDemo: boolean;
}

export interface ComputeRealisableValueInput {
  lot: FarmerLot;
  /** Destination mandi price (modal). */
  price: MarketPrice;
  /** Optional overrides; fall back to defaults. */
  logistics?: LogisticsEstimate;
}

/**
 * Compute realisable value for a lot at a given mandi.
 * Pure, deterministic. Safe to call in render.
 */
export function computeRealisableValue({
  lot,
  price,
  logistics,
}: ComputeRealisableValueInput): RealisableValue {
  const quantityKg = Math.max(0, lot.quantityKg ?? 0);

  // Mandi prices are stored per quintal in the mock; convert to ₹/kg.
  // We always trust the market's modalPrice.
  const effectivePricePerKg = price.modalPrice / KG_PER_QUINTAL;

  const gross = Math.max(0, effectivePricePerKg * quantityKg);

  const distanceKm = Math.max(0, logistics?.distanceKm ?? 0);
  const costPerKm = logistics?.costPerKm ?? 0;

  const loadingPerKg =
    logistics?.loadingPerKg ?? DEFAULT_LOGISTICS_COSTS.loadingPerKg;
  const unloadingPerKg =
    logistics?.unloadingPerKg ?? DEFAULT_LOGISTICS_COSTS.unloadingPerKg;
  const marketFeePct =
    logistics?.marketFeePct ?? DEFAULT_LOGISTICS_COSTS.marketFeePct;
  const insurancePct =
    logistics?.insurancePct ?? DEFAULT_LOGISTICS_COSTS.insurancePct;
  const otherFlat = logistics?.otherFlat ?? DEFAULT_LOGISTICS_COSTS.otherFlat;

  const transport = distanceKm * costPerKm;
  const loading = loadingPerKg * quantityKg;
  const unloading = unloadingPerKg * quantityKg;
  const marketFee = marketFeePct * gross;
  const insurance = insurancePct * gross;
  const other = otherFlat;

  const breakdownTotal = transport + loading + unloading + marketFee + insurance + other;
  const net = Math.max(0, gross - breakdownTotal);
  const netPerKg = quantityKg === 0 ? 0 : net / quantityKg;

  return {
    pricePerKg: effectivePricePerKg,
    marketName: price.market,
    quantityKg,
    gross,
    breakdown: {
      transport,
      loading,
      unloading,
      marketFee,
      insurance,
      other,
      total: breakdownTotal,
    },
    net,
    netPerKg,
    isDemo: true,
  };
}

/**
 * Convenience: format every line of the breakdown for tooltip UI.
 */
export function realisableValueLines(rv: RealisableValue): Array<{
  label: string;
  amount: number;
  isDeduction: boolean;
}> {
  return [
    { label: "Gross (modal price × qty)", amount: rv.gross, isDeduction: false },
    { label: "Transport", amount: rv.breakdown.transport, isDeduction: true },
    { label: "Loading", amount: rv.breakdown.loading, isDeduction: true },
    { label: "Unloading", amount: rv.breakdown.unloading, isDeduction: true },
    { label: "Market fee", amount: rv.breakdown.marketFee, isDeduction: true },
    { label: "Insurance", amount: rv.breakdown.insurance, isDeduction: true },
    { label: "Other", amount: rv.breakdown.other, isDeduction: true },
    { label: "Net realisable", amount: rv.net, isDeduction: false },
  ];
}
