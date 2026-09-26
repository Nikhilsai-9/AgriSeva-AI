/**
 * PHASE 2 P2.A - shared cron helper for tier-aware market ingestion.
 *
 * The original marketIngestCron.ts ran the entire watchlist every
 * 6 hours in a single blast (wasteful for low-volatility commodities
 * like sugarcane and spices; infrequent for high-volatility ones
 * like tomato and onion). This helper wires each tier to its own
 * cron expression derived from the configured refreshHours in
 * config/marketWatchlist.config.ts.
 *
 * Schedule offsets are pinned so HIGH/MEDIUM/LOW never collide on the
 * same minute (Node-cron does not deduplicate overlapping ticks):
 *
 *   HIGH   - top of every 4 hours, minute 7   -> 7 star/4 star star star
 *   MEDIUM - top of every 8 hours, minute 17  -> 17 star/8 star star star
 *   LOW    - top of every day, minute 27      -> 27 0 star star star
 *
 * All three are TZ-Asia/Kolkata so day is the local mandi day.
 */
import cron from 'node-cron';
import {getContainer} from '../loadModules.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketIngestionService} from '#root/modules/marketIntelligence/services/MarketIngestionService.js';
import type {WatchlistTier} from '#root/modules/marketIntelligence/config/marketWatchlist.config.js';

export const TIER_CRON_EXPRESSIONS: Readonly<Record<WatchlistTier, string>> =
  Object.freeze({
    HIGH: '7 */4 * * *',
    MEDIUM: '17 */8 * * *',
    LOW: '27 0 * * *',
  });

export const TIER_CRON_DESCRIPTIONS: Readonly<Record<WatchlistTier, string>> =
  Object.freeze({
    HIGH: 'every 4h (perishables & vegetables)',
    MEDIUM: 'every 8h (cereals, pulses, oilseeds)',
    LOW: 'every 24h (cash crops & spices)',
  });

export type TierJobResult = {
  totalTargets: number;
  successful: number;
  recordsPersisted: number;
  durationMs: number;
};

/**
 * Run a single tier's ingestion once (used both by cron ticks and by
 * the manual `/api/market-prices/refresh?tier=HIGH` admin path).
 */
export async function runMarketIngestionJobForTier(
  tier: WatchlistTier,
): Promise<TierJobResult> {
  const start = Date.now();
  console.log(`<<JOB>> [MarketIngest:${tier}] Starting tier ingestion`);
  try {
    const container = getContainer();
    const ingestionService = container.get<MarketIngestionService>(
      GLOBAL_TYPES.MarketIngestionService,
    );
    const results = await ingestionService.runWatchlistForTier(tier);
    const ok = results.filter((r) => r.success).length;
    const totalRows = results.reduce(
      (a, r) => a + r.recordsPersisted,
      0,
    );
    const durationMs = Date.now() - start;
    console.log(
      `<<JOB>> [MarketIngest:${tier}] Done in ${durationMs}ms — ` +
        `${ok}/${results.length} ok, ${totalRows} rows upserted`,
    );
    return {
      totalTargets: results.length,
      successful: ok,
      recordsPersisted: totalRows,
      durationMs,
    };
  } catch (err) {
    console.error(`<<JOB>> [MarketIngest:${tier}] Error:`, err);
    throw err;
  }
}

const ENABLED =
  String(process.env.ENABLE_MARKET_INGEST_CRON ?? 'true').toLowerCase() !==
  'false';

if (ENABLED) {
  for (const tier of Object.keys(TIER_CRON_EXPRESSIONS) as WatchlistTier[]) {
    cron.schedule(
      TIER_CRON_EXPRESSIONS[tier],
      async () => {
        try {
          await runMarketIngestionJobForTier(tier);
        } catch {
          // already logged inside runMarketIngestionJobForTier
        }
      },
      {timezone: 'Asia/Kolkata'},
    );
    console.log(
      `<<JOB>> [MarketIngest:${tier}] Scheduled (${TIER_CRON_EXPRESSIONS[tier]} Asia/Kolkata) — ${TIER_CRON_DESCRIPTIONS[tier]}`,
    );
  }
}
