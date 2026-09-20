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

const ENABLED =
  String(process.env.ENABLE_MARKET_INGEST_CRON ?? 'true').toLowerCase() !==
  'false';

if (ENABLED) {
  // every 6 hours at minute 7 (offset from other crons)
  cron.schedule(
    '7 */6 * * *',
    async () => {
      const start = Date.now();
      console.log('<<CRON>> [MarketIngest] Starting 6h watchlist ingestion');
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
        console.log(
          `<<CRON>> [MarketIngest] Done in ${Date.now() - start}ms — ` +
            `${ok}/${results.length} ok, ${totalRows} rows upserted`,
        );
      } catch (err) {
        console.error('<<CRON>> [MarketIngest] Error:', err);
      }
    },
    {timezone: 'Asia/Kolkata'},
  );
}
