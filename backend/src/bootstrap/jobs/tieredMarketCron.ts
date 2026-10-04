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
export interface MarketSyncStatus {
  lastSyncAt: string | null;
  lastTier: WatchlistTier | 'ALL' | null;
  lastDurationMs: number | null;
  lastSuccessfulTargets: number | null;
  lastTotalTargets: number | null;
  lastRecordsPersisted: number | null;
  lastStatus: 'success' | 'partial' | 'failed' | 'in_flight' | 'idle';
  isRealtimeActive: boolean;
  nextScheduledCron: string;
}

const ENABLED =
  String(process.env.ENABLE_MARKET_INGEST_CRON ?? 'true').toLowerCase() !==
  'false';

let currentSyncStatus: MarketSyncStatus = {
  lastSyncAt: null,
  lastTier: null,
  lastDurationMs: null,
  lastSuccessfulTargets: null,
  lastTotalTargets: null,
  lastRecordsPersisted: null,
  lastStatus: 'idle',
  isRealtimeActive: ENABLED,
  nextScheduledCron: TIER_CRON_EXPRESSIONS.HIGH,
};

export function getMarketSyncStatus(): MarketSyncStatus {
  return {...currentSyncStatus};
}

/**
 * Run a single tier's ingestion once (used both by cron ticks and by
 * the manual `/api/market-prices/refresh?tier=HIGH` admin path).
 */
export async function runMarketIngestionJobForTier(
  tier: WatchlistTier,
): Promise<TierJobResult> {
  const start = Date.now();
  currentSyncStatus.lastStatus = 'in_flight';
  currentSyncStatus.lastTier = tier;
  console.log(`<<JOB>> [MarketIngest:${tier}] Starting automated tier ingestion`);
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
    currentSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      lastTier: tier,
      lastDurationMs: durationMs,
      lastSuccessfulTargets: ok,
      lastTotalTargets: results.length,
      lastRecordsPersisted: totalRows,
      lastStatus: ok === results.length ? 'success' : ok > 0 ? 'partial' : 'failed',
      isRealtimeActive: ENABLED,
      nextScheduledCron: TIER_CRON_EXPRESSIONS.HIGH,
    };
    return {
      totalTargets: results.length,
      successful: ok,
      recordsPersisted: totalRows,
      durationMs,
    };
  } catch (err) {
    currentSyncStatus = {
      ...currentSyncStatus,
      lastSyncAt: new Date().toISOString(),
      lastStatus: 'failed',
    };
    console.error(`<<JOB>> [MarketIngest:${tier}] Error:`, err);
    throw err;
  }
}

if (ENABLED) {
  // 1. Scheduled tiered crons (standard cadence)
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

  // 2. Automated real-time synchronization for HIGH-volatility commodities (every 30m by default)
  const realtimeCron = process.env.MARKET_REALTIME_SYNC_CRON ?? '*/30 * * * *';
  cron.schedule(
    realtimeCron,
    async () => {
      try {
        console.log(`<<JOB>> [MarketIngest:RealTime] Auto-sync triggered for HIGH-tier crops (${realtimeCron})`);
        await runMarketIngestionJobForTier('HIGH');
      } catch (err: any) {
        console.warn('<<JOB>> [MarketIngest:RealTime] Periodic sync non-fatal warning:', err?.message);
      }
    },
    {timezone: 'Asia/Kolkata'},
  );
  console.log(`<<JOB>> [MarketIngest:RealTime] Automated real-time sync active (${realtimeCron} Asia/Kolkata)`);

  // 3. Automated initial sync on startup (after 5s delay to let DB settle)
  const syncOnStartup = String(process.env.SYNC_MARKET_ON_STARTUP ?? 'true').toLowerCase() !== 'false';
  if (syncOnStartup) {
    setTimeout(async () => {
      console.log('<<JOB>> [MarketIngest:BOOT] Running automated startup sync for HIGH tier commodities...');
      try {
        await runMarketIngestionJobForTier('HIGH');
      } catch (e: any) {
        console.warn('<<JOB>> [MarketIngest:BOOT] Initial sync non-fatal warning:', e?.message);
      }
    }, 5000);
  }
}
