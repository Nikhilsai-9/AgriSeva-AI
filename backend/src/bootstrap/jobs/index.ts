import './questionStatus.js';
import './notificationDelete.js'
import './backupDB.js'
import './dailyReport.js'
// import './absentCron.js'//previously commented
import './reAllocateCron.js'
import './timeBoundReAllocateCron.js'
import './moderatorQueueCron.js'
import './agentStatusCleanupJob.js';
import './gateKeeperAuditorQueueCron.js'
import './feedbackAllocationCron.js'
//import './embeddingBackfill.js'//previously commented
// PHASE 2 §P2.A — split the old single-blast `marketIngestCron` into
// three tier-aware cron jobs (HIGH/MEDIUM/LOW). The old file is kept
// only as a helper for manual full-watchlist refreshes.
import './marketIngestCron.js';
import './tieredMarketCron.js';
export const initJobs = () => {
  console.log('[CRON] Jobs initialized.');
};
