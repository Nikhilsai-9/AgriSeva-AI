import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { app } from './app.js';
import { runMarketIngestionJob } from './bootstrap/jobs/marketIngestCron.js';

/**
 * AgriSeva-AI Cloud Function (2nd Gen) HTTP Entry Point
 * Serves all Express routes (/api/...) on asia-south1
 */
export const api = onRequest(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 60,
    cors: true,
  },
  app,
);

/**
 * AgriSeva-AI Market Ingestion Scheduled Function (2nd Gen)
 * Ingests live market data every 6 hours (at minute 7) in Asia/Kolkata
 */
export const marketIngestScheduled = onSchedule(
  {
    schedule: '7 */6 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    console.log('[ScheduledFunction] Starting scheduled market ingestion run...');
    await runMarketIngestionJob();
    console.log('[ScheduledFunction] Scheduled market ingestion completed successfully.');
  },
);
