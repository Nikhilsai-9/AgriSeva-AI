/**
 * Market intelligence commodity watchlist.
 *
 * PHASE 1 §P1.3 — replaces the old `DEFAULT_WATCHLIST` (which only
 * covered 5 of the 18 commodities the farmer UI advertises) with a
 * tiered watchlist covering the full catalogue. The intent is
 * straightforward: **no advertised commodity should silently rot
 * without a fresh ingestion**.
 *
 * Tiers (priority order — HIGH first):
 *   • HIGH   — perishables + vegetables with high daily price
 *              volatility. Highest user impact; refreshed most often.
 *   • MEDIUM — staples, cereals, pulses, oilseeds. Refreshed less
 *              often because price moves more slowly.
 *   • LOW    — cash crops (sugarcane), slow-moving spices. Refreshed
 *              the least because Agmarknet data is itself sparse.
 *
 * NOTE — the cron schedules per tier are documented here for
 * transparency but are **not yet wired up**. The current behaviour
 * (PHASE 1) is "all tiers in a single 6-hourly run", because
 * flipping the schedule is a separate operational concern
 * (PHASE 1 §P1.3 STOP: do not change cron cadence without
 * operator sign-off — risk of bursty Agmarknet load).
 *
 * Add or remove a commodity here and the watchlist will pick it up
 * on the next process restart — no code change required in the
 * ingestion service.
 */

import type {MarketIngestionTarget} from '../types.js';

/** Tier identifier. Higher tiers are refreshed more often. */
export type WatchlistTier = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * A single watchlist entry: what to fetch and at what cadence.
 *
 * The `limit` field is a soft hint — Agmarknet will return whatever
 * it has for that commodity. We keep it small for spices (LOW tier)
 * because the upstream dataset is sparse.
 */
export interface WatchlistEntry {
  commodity: string;
  /** Max records to request upstream. Defaults to 50. */
  limit: number;
  tier: WatchlistTier;
  /** Refresh cadence in hours (operational intent; not yet wired). */
  refreshHours: number;
  /** Free-text rationale for why this commodity is in this tier. */
  reason: string;
}

/** The full HIGH-priority watchlist (perishables + vegetables). */
const HIGH: WatchlistEntry[] = [
  {
    commodity: 'Tomato',
    limit: 75,
    tier: 'HIGH',
    refreshHours: 4,
    reason: 'Daily price volatility; highest farmer query volume.',
  },
  {
    commodity: 'Onion',
    limit: 75,
    tier: 'HIGH',
    refreshHours: 4,
    reason: 'Politically sensitive staple; daily volatility.',
  },
  {
    commodity: 'Potato',
    limit: 60,
    tier: 'HIGH',
    refreshHours: 6,
    reason: 'Staple vegetable; moderate volatility.',
  },
  {
    commodity: 'Chilli',
    limit: 50,
    tier: 'HIGH',
    refreshHours: 6,
    reason: 'High-value spice with regional price swings.',
  },
];

/** The MEDIUM-priority watchlist (cereals, pulses, oilseeds, fibre). */
const MEDIUM: WatchlistEntry[] = [
  {
    commodity: 'Rice',
    limit: 50,
    tier: 'MEDIUM',
    refreshHours: 8,
    reason: 'Staple cereal; slow price drift.',
  },
  {
    commodity: 'Wheat',
    limit: 50,
    tier: 'MEDIUM',
    refreshHours: 8,
    reason: 'Staple cereal; slow price drift.',
  },
  {
    commodity: 'Maize',
    limit: 50,
    tier: 'MEDIUM',
    refreshHours: 8,
    reason: 'Feed + food grain; moderate volatility.',
  },
  {
    commodity: 'Cotton',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Fibre crop; price driven by policy + global markets.',
  },
  {
    commodity: 'Soybean',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Oilseed; price moves with global oilseed complex.',
  },
  {
    commodity: 'Groundnut',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Oilseed; moderate volatility.',
  },
  {
    commodity: 'Black Gram',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Pulse; moderate volatility.',
  },
  {
    commodity: 'Green Gram',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Pulse; moderate volatility.',
  },
  {
    commodity: 'Pigeon Pea',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Pulse (Tur/Arhar); moderate volatility.',
  },
  {
    commodity: 'Mustard',
    limit: 40,
    tier: 'MEDIUM',
    refreshHours: 12,
    reason: 'Oilseed; moderate volatility.',
  },
];

/** The LOW-priority watchlist (slow-moving spices + cash crops). */
const LOW: WatchlistEntry[] = [
  {
    commodity: 'Sugarcane',
    limit: 30,
    tier: 'LOW',
    refreshHours: 24,
    reason: 'Long-cycle cash crop; infrequent price moves.',
  },
  {
    commodity: 'Turmeric',
    limit: 30,
    tier: 'LOW',
    refreshHours: 24,
    reason: 'Spice; Agmarknet coverage is sparse.',
  },
  {
    commodity: 'Coriander',
    limit: 30,
    tier: 'LOW',
    refreshHours: 24,
    reason: 'Spice; Agmarknet coverage is sparse.',
  },
  {
    commodity: 'Cumin',
    limit: 30,
    tier: 'LOW',
    refreshHours: 24,
    reason: 'Spice; Agmarknet coverage is sparse.',
  },
];

/** Full watchlist — flattened, in tier order. */
export const MARKET_WATCHLIST: WatchlistEntry[] = [
  ...HIGH,
  ...MEDIUM,
  ...LOW,
];

/**
 * The watchlist rendered as `MarketIngestionTarget[]` — the shape the
 * ingestion service consumes. We preserve the flat, tier-ordered
 * structure so consumers can iterate in priority order.
 */
export const MARKET_WATCHLIST_TARGETS: MarketIngestionTarget[] =
  MARKET_WATCHLIST.map(e => ({
    commodity: e.commodity,
    limit: e.limit,
  }));

/** Convenience accessor — count by tier. */
export function countByTier(tier: WatchlistTier): number {
  return MARKET_WATCHLIST.filter(e => e.tier === tier).length;
}

/** Total commodity count covered by the watchlist. */
export const WATCHLIST_TOTAL = MARKET_WATCHLIST.length;
