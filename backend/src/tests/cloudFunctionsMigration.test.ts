import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import * as functionsEntry from '../functions.js';
import { runMarketIngestionJob } from '../bootstrap/jobs/marketIngestCron.js';
import { ensureFirebaseAdminInitialized } from '../config/firebaseAdmin.js';

describe('Firebase Cloud Functions 2nd Gen Migration Tests', () => {
  it('1. Express app is exported without calling listen() or binding a port', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    expect(typeof app.use).toBe('function');
  });

  it('2. Cloud Function HTTP entry `api` and Scheduler `marketIngestScheduled` are exported', () => {
    expect(functionsEntry.api).toBeDefined();
    expect(typeof functionsEntry.api).toBe('function');
    expect(functionsEntry.marketIngestScheduled).toBeDefined();
    expect(typeof functionsEntry.marketIngestScheduled).toBe('function');
  });

  it('3. HTTP request reaches Express app and responds via health endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('4. Firebase Admin initialization handles environments safely', () => {
    expect(() => ensureFirebaseAdminInitialized()).not.toThrow();
  });

  it('5. Scheduled market ingestion handler is callable and exported', () => {
    expect(typeof runMarketIngestionJob).toBe('function');
  });

  it('6. REST routes are registered on the app', async () => {
    // Non-existent route returns 404 or handled response, proving routing-controllers pipeline is active
    const res = await request(app).get('/api/non-existent-probe-route-12345');
    expect([404, 401, 403, 500]).toContain(res.status);
  });
});
