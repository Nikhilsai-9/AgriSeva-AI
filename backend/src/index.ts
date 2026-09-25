import http from 'http';
import { app } from './app.js';
import { appConfig } from './config/app.js';
import { initJobs } from './bootstrap/jobs/index.js';
import { initWebSocket } from './bootstrap/websocket.js';
import { printStartupSummary } from './utils/logDetails.js';

const server = http.createServer(app);

// Initialize local telephony WebSocket streaming (/plivo-stream)
initWebSocket(server);

server.listen(appConfig.port, () => {
  initJobs();
  printStartupSummary();
});

export { server };
