/**
 * Unit tests for MarketInsightController and MarketComparisonController.
 *
 * Both controllers are thin wrappers over services — the tests assert
 * that:
 *   1. `commodity` is enforced as required (400 when missing).
 *   2. Services are called with the supplied query args.
 *   3. The response envelope includes `isDemo` + `success`.
 */

import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import {useExpressServer, useContainer} from 'routing-controllers';
import {Container} from 'inversify';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {describe, it, expect, beforeAll, beforeEach, vi} from 'vitest';
import {HttpErrorHandler} from '#shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketInsightController} from '../controllers/MarketInsightController.js';
import {MarketComparisonController} from '../controllers/MarketComparisonController.js';
import type {MarketPriceRecord} from '../types.js';

// ─── Mock data ───────────────────────────────────────────────────────

const baseRecord: MarketPriceRecord = {
  recordKey: 'agmarknet::2026-04-15::Karnataka::Kolar::Tomato::Hybrid',
  source: 'agmarknet',
  sourceSystem: 'Agmarknet (Government of India)',
  sourceUrl: 'https://api.example/agmarknet',
  state: 'Karnataka',
  district: 'Kolar',
  market: 'Kolar Mandi',
  commodity: 'Tomato',
  crop: 'Tomato',
  variety: 'Hybrid',
  grade: 'FAQ',
  unit: '₹/quintal',
  minPrice: 1200,
  maxPrice: 1800,
  modalPrice: 1500,
  arrivalDate: '2026-04-15',
  reportedAt: '2026-04-15T10:00:00.000Z',
  ingestedAt: '2026-04-15T10:00:05.000Z',
  changePct: null,
  trendPct: null,
  fetchStatus: 'live',
};

const annotatedRecord: MarketPriceRecord = {
  ...baseRecord,
  changePct: 2.5,
};

// ─── Mock services ───────────────────────────────────────────────────

const mockPriceRepo = {
  findMany: vi.fn(),
};

const mockHistoryService = {
  annotateWithChange: vi.fn(),
};

const mockRecommendationService = {
  compare: vi.fn(),
};

// ─── App setup ───────────────────────────────────────────────────────

describe('MarketInsightController', () => {
  let app: any;

  beforeAll(() => {
    const container = new Container();
    container.bind(MarketInsightController).toSelf().inSingletonScope();
    container
      .bind(GLOBAL_TYPES.MarketPriceRepository)
      .toConstantValue(mockPriceRepo);
    container
      .bind(GLOBAL_TYPES.MarketHistoryService)
      .toConstantValue(mockHistoryService);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [MarketInsightController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: true,
      authorizationChecker: async () => true,
      currentUserChecker: async () => ({}),
    });
  });

  beforeEach(() => {
    mockPriceRepo.findMany.mockClear();
    mockHistoryService.annotateWithChange.mockClear();
  });

  it('returns isDemo=true when no rows match', async () => {
    mockPriceRepo.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get(
      '/market-insights/today?commodity=Tomato&state=Karnataka',
    );

    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(true);
    expect(res.body.insight).toBeNull();
    expect(mockPriceRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({commodity: 'Tomato', state: 'Karnataka'}),
      20,
    );
  });

  it('returns the latest insight with source + change% when rows exist', async () => {
    const older = {...annotatedRecord, arrivalDate: '2026-04-14', modalPrice: 1463};
    mockPriceRepo.findMany.mockResolvedValueOnce([baseRecord, older]);
    mockHistoryService.annotateWithChange.mockReturnValueOnce([
      annotatedRecord,
      {...annotatedRecord, arrivalDate: '2026-04-14', changePct: 1.1},
    ]);

    const res = await request(app).get(
      '/market-insights/today?commodity=Tomato',
    );

    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(false);
    expect(res.body.insight.commodity).toBe('Tomato');
    expect(res.body.insight.modalPrice).toBe(1500);
    expect(res.body.insight.source).toBe('agmarknet');
    expect(res.body.insight.changePct).toBe(2.5);
    // Latest record is the 2026-04-15 one (modalPrice 1500)
    expect(res.body.insight.arrivalDate).toBe('2026-04-15');
  });

  it('returns 400 when commodity is missing', async () => {
    const res = await request(app).get('/market-insights/today');
    expect(res.status).toBe(400);
  });
});

describe('MarketComparisonController', () => {
  let app: any;

  beforeAll(() => {
    const container = new Container();
    container.bind(MarketComparisonController).toSelf().inSingletonScope();
    container
      .bind(GLOBAL_TYPES.RecommendationService)
      .toConstantValue(mockRecommendationService);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [MarketComparisonController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: true,
      authorizationChecker: async () => true,
      currentUserChecker: async () => ({}),
    });
  });

  beforeEach(() => {
    mockRecommendationService.compare.mockClear();
  });

  it('returns comparison rows + recommendation', async () => {
    mockRecommendationService.compare.mockResolvedValueOnce({
      isDemo: false,
      fetchedAt: '2026-04-15T10:00:00.000Z',
      rows: [
        {
          market: 'Kolar Mandi',
          state: 'Karnataka',
          district: 'Kolar',
          commodity: 'Tomato',
          modalPrice: 1500,
          unit: 'quintal',
          arrivalDate: '2026-04-15',
          source: 'agmarknet',
          sourceSystem: 'Agmarknet',
        },
        {
          market: 'Mysuru Mandi',
          state: 'Karnataka',
          district: 'Mysuru',
          commodity: 'Tomato',
          modalPrice: 1480,
          unit: 'quintal',
          arrivalDate: '2026-04-15',
          source: 'agmarknet',
          sourceSystem: 'Agmarknet',
        },
      ],
      recommendation: {
        market: 'Kolar Mandi',
        state: 'Karnataka',
        commodity: 'Tomato',
        modalPrice: 1500,
        unit: 'quintal',
        arrivalDate: '2026-04-15',
        source: 'agmarknet',
        sourceSystem: 'Agmarknet',
        reason: 'Highest modal price in the latest comparison set.',
      },
    });

    const res = await request(app).get(
      '/market-comparison?commodity=Tomato&state=Karnataka&limit=10',
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isDemo).toBe(false);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.recommendation.market).toBe('Kolar Mandi');
    expect(mockRecommendationService.compare).toHaveBeenCalledWith(
      expect.objectContaining({
        commodity: 'Tomato',
        state: 'Karnataka',
        limit: 10,
      }),
    );
  });

  it('returns isDemo=true when recommendation rows are empty', async () => {
    mockRecommendationService.compare.mockResolvedValueOnce({
      isDemo: true,
      fetchedAt: '2026-04-15T10:00:00.000Z',
      rows: [],
      recommendation: null,
    });

    const res = await request(app).get('/market-comparison?commodity=AtlantisFruit');

    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(true);
    expect(res.body.rows).toHaveLength(0);
    expect(res.body.recommendation).toBeNull();
  });

  it('returns 400 when commodity is missing', async () => {
    const res = await request(app).get('/market-comparison');
    expect(res.status).toBe(400);
  });
});

