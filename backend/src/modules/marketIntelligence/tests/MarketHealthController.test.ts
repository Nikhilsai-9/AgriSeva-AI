/**
 * Unit tests for MarketHealthController.
 *
 * Asserts that the controller surfaces both MCP endpoints + reliability
 * snapshots so an operator can confirm both upstreams are reachable.
 */

import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import {useExpressServer, useContainer} from 'routing-controllers';
import {Container} from 'inversify';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {HttpErrorHandler} from '#shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketHealthController} from '../controllers/MarketHealthController.js';
import type {MarketReliabilitySnapshot} from '../types.js';

// ─── Mocks ───────────────────────────────────────────────────────────

const mockAgmarknet = {
  getEndpoint: vi.fn().mockReturnValue('https://agmarknet.local/api'),
};

const mockEnam = {
  getEndpoint: vi.fn().mockReturnValue('https://enam.local/api'),
};

const mockReliabilityService = {
  snapshot: vi.fn(),
};

const agSnap: MarketReliabilitySnapshot = {
  source: 'agmarknet',
  score: 92,
  label: 'Excellent',
  lastSuccessAt: '2026-04-15T09:55:00.000Z',
  lastAttemptAt: '2026-04-15T09:55:00.000Z',
  consecutiveFailures: 0,
  recentSuccessesLast24h: 4,
  recentAttemptsLast24h: 4,
  reasons: ['Fresh within 6h', 'No consecutive failures'],
};

const enSnap: MarketReliabilitySnapshot = {
  source: 'enam',
  score: 64,
  label: 'Good',
  lastSuccessAt: '2026-04-15T08:00:00.000Z',
  lastAttemptAt: '2026-04-15T03:00:00.000Z',
  consecutiveFailures: 1,
  recentSuccessesLast24h: 3,
  recentAttemptsLast24h: 4,
  reasons: ['Mildly stale', '1 failure in last 24h'],
};

// ─── App setup ───────────────────────────────────────────────────────

describe('MarketHealthController', () => {
  let app: any;

  beforeAll(() => {
    const container = new Container();
    container.bind(MarketHealthController).toSelf().inSingletonScope();
    container.bind(GLOBAL_TYPES.AgmarknetMcpClient).toConstantValue(mockAgmarknet);
    container.bind(GLOBAL_TYPES.EnamMcpClient).toConstantValue(mockEnam);
    container
      .bind(GLOBAL_TYPES.MarketReliabilityService)
      .toConstantValue(mockReliabilityService);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [MarketHealthController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: true,
      authorizationChecker: async () => true,
      currentUserChecker: async () => ({}),
    });
  });

  it('returns both sources with endpoint + reliability snapshot', async () => {
    mockReliabilityService.snapshot.mockResolvedValueOnce(agSnap);
    mockReliabilityService.snapshot.mockResolvedValueOnce(enSnap);

    const res = await request(app).get('/market-health/');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sources).toHaveLength(2);

    const agRow = res.body.sources.find((s: any) => s.id === 'agmarknet');
    const enRow = res.body.sources.find((s: any) => s.id === 'enam');

    expect(agRow.endpoint).toBe('https://agmarknet.local/api');
    expect(agRow.reliability.score).toBe(92);
    expect(agRow.reliability.label).toBe('Excellent');

    expect(enRow.endpoint).toBe('https://enam.local/api');
    expect(enRow.reliability.score).toBe(64);
    expect(enRow.reliability.label).toBe('Good');

    expect(mockReliabilityService.snapshot).toHaveBeenCalledTimes(2);
    expect(mockReliabilityService.snapshot).toHaveBeenNthCalledWith(1, 'agmarknet');
    expect(mockReliabilityService.snapshot).toHaveBeenNthCalledWith(2, 'enam');
  });

  it('handles degraded reliability when both sources score 0', async () => {
    mockReliabilityService.snapshot.mockResolvedValueOnce({
      ...agSnap,
      score: 0,
      label: 'Limited',
      lastSuccessAt: undefined,
    });
    mockReliabilityService.snapshot.mockResolvedValueOnce({
      ...enSnap,
      score: 0,
      label: 'Limited',
      lastSuccessAt: undefined,
    });

    const res = await request(app).get('/market-health/');

    expect(res.status).toBe(200);
    expect(res.body.sources[0].reliability.label).toBe('Limited');
    expect(res.body.sources[0].reliability.score).toBe(0);
  });
});

