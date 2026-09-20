/**
 * Unit tests for MarketPricesController.
 *
 * Mocks the repository + 3 services and asserts:
 *   1. Validates query params.
 *   2. Builds repository filters correctly.
 *   3. Delegates to history/reliability/ingestion services.
 *   4. Returns response envelopes that include `isDemo` and `source`
 *      so the frontend can render Source/Live/Demo badges.
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
import {MarketPricesController} from '../controllers/MarketPricesController.js';
import type {
  MarketPriceRecord,
  MarketReliabilitySnapshot,
  MarketIngestionResult,
} from '../types.js';

// ─── Shared mock data ────────────────────────────────────────────────

const baseRecord: MarketPriceRecord = {
  recordKey: 'agmarknet::2026-04-15::Karnataka::Kolar::Tomato::Hybrid',
  source: 'agmarknet',
  sourceSystem: 'Agmarknet',
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
  ingestedAt: '2026-04-15T10:05:00.000Z',
  changePct: null,
  trendPct: null,
  fetchStatus: 'live',
};

const annotatedRecord: MarketPriceRecord = {
  ...baseRecord,
  changePct: 3.2,
};

const mockReliability: MarketReliabilitySnapshot = {
  source: 'agmarknet',
  score: 92,
  label: 'High reliability',
  lastSuccessAt: '2026-04-15T09:55:00.000Z',
  lastAttemptAt: '2026-04-15T09:55:00.000Z',
  consecutiveFailures: 0,
  recentSuccessesLast24h: 4,
  recentAttemptsLast24h: 4,
  reasons: ['Fresh within last 6h', 'No recent failures'],
};

// ─── Mock services ───────────────────────────────────────────────────

const mockPriceRepo = {
  findMany: vi.fn(),
  upsert: vi.fn(),
  upsertMany: vi.fn(),
  findByRecordKey: vi.fn(),
  findHistory: vi.fn(),
  countBySource: vi.fn().mockResolvedValue({agmarknet: 100, enam: 30}),
};

const mockHistoryService = {
  annotateWithChange: vi.fn(),
  getHistory: vi.fn(),
};

const mockReliabilityService = {
  snapshot: vi.fn(),
  snapshotAll: vi.fn(),
};

const mockIngestionService = {
  ingest: vi.fn(),
  runWatchlist: vi.fn(),
};

/**
 * Default commodity resolver — passes input through unchanged. Individual
 * tests override `resolve` to simulate alias-aware expansion (e.g.
 * "Bajra" → ["Bajra", "Bajra(Pearl Millet/Cumbu)"]).
 */
const mockCommodityResolver = {
  resolve: vi.fn(async (q: string) => ({
    input: q,
    candidates: q ? [q] : [],
    matchedAlias: false,
  })),
  extractBaseName: (s: string | null | undefined) => {
    if (!s) return undefined;
    const t = s.trim();
    const i = t.indexOf('(');
    if (i <= 0) return t || undefined;
    const base = t.slice(0, i).trim();
    return base || undefined;
  },
};

// ─── App setup ───────────────────────────────────────────────────────

describe('MarketPricesController', () => {
  let app: any;

  beforeAll(() => {
    const container = new Container();
    container.bind(MarketPricesController).toSelf().inSingletonScope();
    container
      .bind(GLOBAL_TYPES.MarketPriceRepository)
      .toConstantValue(mockPriceRepo);
    container
      .bind(GLOBAL_TYPES.MarketHistoryService)
      .toConstantValue(mockHistoryService);
    container
      .bind(GLOBAL_TYPES.MarketReliabilityService)
      .toConstantValue(mockReliabilityService);
    container
      .bind(GLOBAL_TYPES.MarketIngestionService)
      .toConstantValue(mockIngestionService);
    container
      .bind(GLOBAL_TYPES.CommodityResolver)
      .toConstantValue(mockCommodityResolver);
    container.bind(HttpErrorHandler).toSelf().inSingletonScope();

    useContainer(new InversifyAdapter(container));

    app = useExpressServer(Express(), {
      controllers: [MarketPricesController],
      middlewares: [HttpErrorHandler],
      defaultErrorHandler: false,
      validation: true,
      authorizationChecker: async () => true,
      currentUserChecker: async () => ({}),
    });
  });

  beforeEach(() => {
    mockPriceRepo.findMany.mockClear();
    mockPriceRepo.upsert.mockClear();
    mockPriceRepo.upsertMany.mockClear();
    mockPriceRepo.findByRecordKey.mockClear();
    mockPriceRepo.findHistory.mockClear();
    mockPriceRepo.countBySource.mockClear();
    mockHistoryService.annotateWithChange.mockClear();
    mockHistoryService.getHistory.mockClear();
    mockReliabilityService.snapshot.mockClear();
    mockReliabilityService.snapshotAll.mockClear();
    mockIngestionService.ingest.mockClear();
    mockIngestionService.runWatchlist.mockClear();
    // Reset commodity resolver to the default (input-only) behaviour
    // and clear its call history; per-test overrides can come after.
    mockCommodityResolver.resolve.mockClear();
    mockCommodityResolver.resolve.mockImplementation(
      async (q: string) => ({
        input: q,
        candidates: q ? [q] : [],
        matchedAlias: false,
      }),
    );
  });

  // ── GET /market-prices ─────────────────────────────────────────────

  describe('GET /market-prices', () => {
    it('returns 200 with annotated rows, isDemo=false when data exists', async () => {
      mockPriceRepo.findMany.mockResolvedValueOnce([baseRecord]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([annotatedRecord]);

      const res = await request(app).get(
        '/market-prices?state=Karnataka&commodity=Tomato&limit=10',
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isDemo).toBe(false);
      expect(res.body.source).toBe('agmarknet');
      expect(res.body.total).toBe(1);
      expect(res.body.prices[0].commodity).toBe('Tomato');
      expect(res.body.prices[0].changePct).toBe(3.2);
      expect(res.body.fetchedAt).toBeTruthy();

      expect(mockPriceRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Karnataka',
          commodity: 'Tomato',
        }),
        10,
      );
    });

    it('marks isDemo=true when no rows are returned', async () => {
      mockPriceRepo.findMany.mockResolvedValueOnce([]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([]);

      const res = await request(app).get('/market-prices?state=Atlantis');

      expect(res.status).toBe(200);
      expect(res.body.isDemo).toBe(true);
      expect(res.body.total).toBe(0);
      expect(res.body.source).toBe('none');
    });

    it('combines sources with + when results span multiple sources', async () => {
      const enamRow = {...baseRecord, source: 'enam', recordKey: 'enam::x::Tomato::'};
      mockPriceRepo.findMany.mockResolvedValueOnce([baseRecord, enamRow]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([
        annotatedRecord,
        {...annotatedRecord, source: 'enam'},
      ]);

      const res = await request(app).get('/market-prices?commodity=Tomato');

      expect(res.status).toBe(200);
      expect(res.body.source).toContain('+');
    });

    it('passes the requested limit through to the repository', async () => {
      mockPriceRepo.findMany.mockResolvedValueOnce([]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([]);

      await request(app).get('/market-prices?limit=250');

      expect(mockPriceRepo.findMany).toHaveBeenCalledWith(
        expect.any(Object),
        250,
      );
    });

    it('rejects limit > 500 with 400 (validator guard)', async () => {
      // Defense-in-depth: the validator caps at 500 so the controller's
      // Math.min cap is only a backstop.
      const res = await request(app).get('/market-prices?limit=99999');
      expect(res.status).toBe(400);
    });

    it('passes a single-canonical exact match when alias map is empty', async () => {
      mockPriceRepo.findMany.mockResolvedValueOnce([baseRecord]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([
        annotatedRecord,
      ]);

      await request(app).get(
        '/market-prices?commodity=Tomato&state=Karnataka',
      );

      expect(mockCommodityResolver.resolve).toHaveBeenCalledWith('Tomato');
      // Single candidate → controller passes a plain string filter
      // (NOT $in) so the MongoDB index on commodity stays optimal.
      expect(mockPriceRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({commodity: 'Tomato'}),
        expect.any(Number),
      );
    });

    it('expands commodity to $in with canonical alias when present', async () => {
      // Simulate the resolver finding an alias for "Bajra".
      mockCommodityResolver.resolve.mockImplementationOnce(
        async (q: string) => ({
          input: q,
          candidates: ['Bajra', 'Bajra(Pearl Millet/Cumbu)'],
          matchedAlias: true,
        }),
      );
      const canonicalRow = {
        ...baseRecord,
        recordKey: 'agmarknet::2026-04-15::Gujarat::Anand::Bajra(Pearl Millet/Cumbu)::',
        commodity: 'Bajra(Pearl Millet/Cumbu)',
        crop: 'Bajra(Pearl Millet/Cumbu)',
        state: 'Gujarat',
        market: 'Anand',
      };
      mockPriceRepo.findMany.mockResolvedValueOnce([canonicalRow]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([canonicalRow]);

      const res = await request(app).get(
        '/market-prices?commodity=Bajra&state=Gujarat',
      );

      expect(res.status).toBe(200);
      expect(res.body.isDemo).toBe(false);
      expect(res.body.prices[0].commodity).toBe('Bajra(Pearl Millet/Cumbu)');
      // The Mongo filter should be $in over both candidates — never
      // a fuzzy regex.
      expect(mockPriceRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          commodity: { $in: ['Bajra', 'Bajra(Pearl Millet/Cumbu)'] },
          state: 'Gujarat',
        }),
        expect.any(Number),
      );
    });

    it('does not fabricate aliases for unknown commodities', async () => {
      // The resolver default in beforeEach returns the input as a
      // single-element candidate list — i.e. no $in, no expansion.
      mockPriceRepo.findMany.mockResolvedValueOnce([]);

      await request(app).get(
        '/market-prices?commodity=TotallyUnknownCrop&state=Karnataka',
      );

      expect(mockCommodityResolver.resolve).toHaveBeenCalledWith(
        'TotallyUnknownCrop',
      );
      const calledWithFilter = mockPriceRepo.findMany.mock.calls[0][0];
      expect(calledWithFilter.commodity).toBe('TotallyUnknownCrop');
      expect(calledWithFilter.commodity).not.toMatchObject({$in: expect.anything()});
    });

    it('response excludes MongoDB _id from every price row', async () => {
      // Simulate a row that a backward caller might attach _id to.
      // The repository is expected to project _id out (a separate
      // contract test lives in MarketPriceRepository, but we also
      // guard at the controller response boundary).
      const rowWithId = {...annotatedRecord} as any;
      rowWithId._id = '65abc123fakeObjectId';
      mockPriceRepo.findMany.mockResolvedValueOnce([rowWithId]);
      mockHistoryService.annotateWithChange.mockReturnValueOnce([rowWithId]);

      const res = await request(app).get(
        '/market-prices?commodity=Tomato&state=Karnataka',
      );

      expect(res.status).toBe(200);
      expect(res.body.prices).toHaveLength(1);
      expect(res.body.prices[0]._id).toBeUndefined();
      // recordKey is the legitimate public identifier; keep it.
      expect(res.body.prices[0].recordKey).toBeTruthy();
    });
  });

  // ── GET /market-prices/history ─────────────────────────────────────

  describe('GET /market-prices/history', () => {
    it('returns time-series points', async () => {
      const points = [
        {arrivalDate: '2026-04-13', modalPrice: 1400, source: 'agmarknet'},
        {arrivalDate: '2026-04-14', modalPrice: 1453, source: 'agmarknet'},
        {arrivalDate: '2026-04-15', modalPrice: 1500, source: 'agmarknet'},
      ];
      mockHistoryService.getHistory.mockResolvedValueOnce(points);

      const res = await request(app).get(
        '/market-prices/history?state=Karnataka&market=Kolar%20Mandi&commodity=Tomato&lookbackDays=7',
      );

      expect(res.status).toBe(200);
      expect(res.body.isDemo).toBe(false);
      expect(res.body.points).toHaveLength(3);
      expect(mockHistoryService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Karnataka',
          market: 'Kolar Mandi',
          commodity: 'Tomato',
          lookbackDays: 7,
        }),
      );
    });

    it('marks isDemo=true when history is empty', async () => {
      mockHistoryService.getHistory.mockResolvedValueOnce([]);
      const res = await request(app).get(
        '/market-prices/history?state=Karnataka&market=X&commodity=Y',
      );
      expect(res.body.isDemo).toBe(true);
    });

    it('returns 400 when state/market/commodity are missing', async () => {
      const res = await request(app).get(
        '/market-prices/history?commodity=Tomato',
      );
      expect(res.status).toBe(400);
    });
  });

  // ── GET /market-prices/reliability ─────────────────────────────────

  describe('GET /market-prices/reliability', () => {
    it('returns per-source snapshots when no source filter is given', async () => {
      mockReliabilityService.snapshotAll.mockResolvedValueOnce([
        mockReliability,
        {...mockReliability, source: 'enam', score: 78, label: 'Medium reliability'},
      ]);

      const res = await request(app).get('/market-prices/reliability');

      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(2);
      expect(res.body.snapshots[0].source).toBe('agmarknet');
      expect(mockReliabilityService.snapshotAll).toHaveBeenCalled();
    });

    it('returns single snapshot when source filter is given', async () => {
      mockReliabilityService.snapshot.mockResolvedValueOnce(mockReliability);

      const res = await request(app).get(
        '/market-prices/reliability?source=agmarknet',
      );

      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(1);
      expect(res.body.snapshots[0].score).toBe(92);
      expect(mockReliabilityService.snapshot).toHaveBeenCalledWith('agmarknet');
    });

    it('returns 400 when source filter is invalid', async () => {
      const res = await request(app).get(
        '/market-prices/reliability?source=facebook',
      );
      expect(res.status).toBe(400);
    });
  });

  // ── POST /market-prices/refresh ────────────────────────────────────

  describe('POST /market-prices/refresh', () => {
    it('delegates to ingestionService.ingest with the supplied target', async () => {
      const result: MarketIngestionResult = {
        success: true,
        source: 'agmarknet',
        recordsNormalised: 10,
        recordsPersisted: 10,
        errors: [],
        startedAt: '2026-04-15T10:00:00.000Z',
        finishedAt: '2026-04-15T10:00:01.000Z',
      };
      mockIngestionService.ingest.mockResolvedValueOnce(result);

      const res = await request(app)
        .post('/market-prices/refresh')
        .send({
          state: 'Karnataka',
          market: 'Kolar Mandi',
          commodity: 'Tomato',
          arrivalDate: '2026-04-15',
          includeFallback: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Ingested 10 rows/);
      expect(res.body.result.source).toBe('agmarknet');
      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        expect.objectContaining({commodity: 'Tomato'}),
        expect.objectContaining({includeFallback: true}),
      );
    });

    it('returns a helpful message when ingestion fails', async () => {
      mockIngestionService.ingest.mockResolvedValueOnce({
        success: false,
        source: 'agmarknet',
        recordsNormalised: 0,
        recordsPersisted: 0,
        errors: ['upstream timeout'],
        startedAt: '2026-04-15T10:00:00.000Z',
        finishedAt: '2026-04-15T10:00:01.000Z',
      });

      const res = await request(app)
        .post('/market-prices/refresh')
        .send({commodity: 'Tomato'});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Ingestion failed/);
    });
  });
});


﻿
