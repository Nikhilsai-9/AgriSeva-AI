/**
 * Demo Market Price Data — clearly labelled.
 *
 * These prices mimic the SHAPE of the response that the existing
 * mcp/other_markets/unified_mandi_prices.py MCP server returns when
 * called for live data. The values themselves are fictional and meant
 * only for prototyping the new farmer dashboard UI.
 *
 * IMPORTANT: every record is marked isDemo=true so the UI can render
 * a "Demo Data" badge.
 */

import type {
  MarketPrice,
  MarketPriceResponse,
  TodayInsight,
} from "../types";

const todayIso = new Date().toISOString().slice(0, 10);

const make = (
  id: string,
  commodity: string,
  market: string,
  state: string,
  district: string,
  min: number,
  max: number,
  modal: number,
  trend: number,
  source: string,
  distanceKm?: number
): MarketPrice => ({
  id,
  commodity,
  market,
  state,
  district,
  minPrice: min,
  maxPrice: max,
  modalPrice: modal,
  unit: "₹/quintal",
  arrivalDate: todayIso,
  source,
  distanceKm,
  trendPct: trend,
});

export const DEMO_MARKET_PRICES: MarketPrice[] = [
  make("p1", "Tomato", "Kolar Mandi", "Karnataka", "Kolar", 2200, 2700, 2450, 8, "data.gov.in", 32),
  make("p2", "Tomato", "Madanapalle Mandi", "Andhra Pradesh", "Chittoor", 2050, 2500, 2280, 3, "data.gov.in", 18),
  make("p3", "Tomato", "Pune APMC", "Maharashtra", "Pune", 1900, 2350, 2120, -2, "data.gov.in", 12),
  make("p4", "Tomato", "Azadpur Mandi", "Delhi", "North Delhi", 2350, 2900, 2580, 5, "Azadpur Mandi", 0),
  make("p5", "Tomato", "Kurnool Mandi", "Andhra Pradesh", "Kurnool", 2150, 2550, 2340, 1, "data.gov.in", 45),
  make("p6", "Onion", "Lasalgaon Mandi", "Maharashtra", "Nashik", 1800, 2400, 2100, 4, "data.gov.in", 28),
  make("p7", "Onion", "Bangalore Mandi", "Karnataka", "Bangalore Urban", 1950, 2500, 2200, 6, "data.gov.in", 41),
  make("p8", "Rice", "Guntur Mandi", "Andhra Pradesh", "Guntur", 3200, 3500, 3350, 0, "data.gov.in", 38),
  make("p9", "Rice", "Karnal Mandi", "Haryana", "Karnal", 3400, 3700, 3550, -1, "data.gov.in", 78),
  make("p10", "Maize", "Davangere Mandi", "Karnataka", "Davangere", 1900, 2150, 2050, 3, "data.gov.in", 22),
  make("p11", "Cotton", "Akola Mandi", "Maharashtra", "Akola", 6800, 7300, 7050, 2, "data.gov.in", 60),
  make("p12", "Groundnut", "Rajkot Mandi", "Gujarat", "Rajkot", 5400, 5900, 5650, -1, "data.gov.in", 92),
  make("p13", "Turmeric", "Erode Mandi", "Tamil Nadu", "Erode", 8500, 9200, 8800, 4, "Indian Spices Board", 70),
  make("p14", "Chilli", "Guntur Mandi", "Andhra Pradesh", "Guntur", 9800, 11000, 10200, 7, "data.gov.in", 38),
];

export const DEMO_TODAY_INSIGHT: TodayInsight = {
  commodity: "Tomato",
  modalPrice: 2450,
  unit: "₹/quintal",
  trendPct: 8,
  trendDirection: "up",
  recommendation:
    "Prices are stronger in Kolar Mandi today. Consider listing your lot there if transport cost is reasonable.",
  strongestMarket: "Kolar Mandi",
  weakestMarket: "Pune APMC",
  distanceKm: 32,
  isDemo: true,
};

export const buildDemoMarketPriceResponse = (
  commodity: string
): MarketPriceResponse => {
  const matches = DEMO_MARKET_PRICES.filter((p) =>
    commodity ? p.commodity.toLowerCase().includes(commodity.toLowerCase()) : true
  );

  return {
    success: matches.length > 0,
    bestMatch: matches[0] ?? null,
    alternatives: matches.slice(1, 5),
    totalResults: matches.length,
    errorMessage: matches.length === 0 ? "No demo data found for selection." : "",
    responseDate: todayIso,
    isDemo: true,
  };
};
