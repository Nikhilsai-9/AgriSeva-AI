/**
 * Manual market-intelligence refresh helper.
 *
 * PHASE 2 §P2.A — the scheduled cron block that previously lived here
 * (every 6h, runs the entire watchlist) has been moved to
 * `./tieredMarketCron.ts`, which schedules the three tier jobs
 * independently:
 *
 *   - HIGH   — every 4 hours (perishables & vegetables)
 *   - MEDIUM — every 8 hours (cereals, pulses, oilseeds)
 *   - LOW    — every 24 hours (cash crops & spices)
 *
 * This file now ONLY exports `runMarketIngestionJob()` so the manual
 * admin path `POST /api/market-prices/refresh` can still trigger a
 * full-watchlist ingestion on demand.
 */

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
  console.log('<<JOB>> [MarketIngest] Starting full watchlist ingestion (manual refresh)');
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

// NOTE: no cron.schedule(...) here — see `./tieredMarketCron.ts` for
// the scheduled tier-aware ingestion jobs. Keeping this file
// schedule-free means there is no risk of double-fetching the
// upstream when both modules are imported.
