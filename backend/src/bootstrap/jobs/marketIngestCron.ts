/**
 * Market-intelligence cron — fetches the default watchlist of high-demand
 * commodities from Agmarknet (primary) → eNAM (fallback) every 6 hours
 * and upserts the results into `market_prices`.
 *
 * Guarded by an `ENABLE_MARKET_INGEST_CRON` env var (default `true`).
 * The MarketIngestionService has its own overlap guard so a slow run
 * will not stack cron ticks.
 */

import cron from 'node-cron';
import {getContainer} from '../loadModules.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketIngestionService} from '#root/modules/marketIntelligence/services/MarketIngestionService.js';

export async function runMarketIngestionJob(): Promise<{
  totalTargets: number;
  successful: number;
  recordsPersisted: number;
  durationMs: number;
}> {
  const start = Date.now();
  console.log('<<JOB>> [MarketIngest] Starting 6h watchlist ingestion');
  try {
    const container = getContainer();
    const ingestionService = container.get<MarketIngestionService>(
      GLOBAL_TYPES.MarketIngestionService,
    );
    const results = await ingestionService.runWatchlist();
    const ok = results.filter(r => r.success).length;
    const totalRows = results.reduce(
      (a, r) => a + r.recordsPersisted,
      0,
    );
    const durationMs = Date.now() - start;
    console.log(
      `<<JOB>> [MarketIngest] Done in ${durationMs}ms — ` +
        `${ok}/${results.length} ok, ${totalRows} rows upserted`,
    );
    return {
      totalTargets: results.length,
      successful: ok,
      recordsPersisted: totalRows,
      durationMs,
    };
  } catch (err) {
    console.error('<<JOB>> [MarketIngest] Error:', err);
    throw err;
  }
}

const ENABLED =
  String(process.env.ENABLE_MARKET_INGEST_CRON ?? 'true').toLowerCase() !==
  'false';

if (ENABLED) {
  // every 6 hours at minute 7 (offset from other crons)
  cron.schedule(
    '7 */6 * * *',
    async () => {
      try {
        await runMarketIngestionJob();
      } catch {
        // Error logged inside runMarketIngestionJob
      }
    },
    {timezone: 'Asia/Kolkata'},
  );
}
