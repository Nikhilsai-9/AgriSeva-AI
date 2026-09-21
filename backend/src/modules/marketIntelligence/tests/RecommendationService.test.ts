/**
 * PHASE 1 §P2.4 — RecommendationService end-to-end (no controller).
 */

import 'reflect-metadata';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {RecommendationService} from '../services/RecommendationService.js';
import type {MarketPriceRecord} from '../types.js';

const baseRecord: MarketPriceRecord = {
  recordKey: 'agmarknet::2026-04-15::Karnataka::Kolar::Tomato',
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
  changePct: 3.2,
  trendPct: null,
  fetchStatus: 'live',
};

const mockRepo = {
  findMany: vi.fn(),
};

const mockHistory = {
  annotateWithChange: vi.fn(),
};

describe('PHASE 1 §P2.4 — RecommendationService', () => {
  let service: RecommendationService;

  beforeEach(() => {
    mockRepo.findMany.mockReset();
    mockHistory.annotateWithChange.mockReset();
    service = new RecommendationService(
      mockRepo as any,
      mockHistory as any,
    );
  });

  it('returns null recommendation + isDemo=true + isDegraded=true on empty result set', async () => {
    mockRepo.findMany.mockResolvedValueOnce([]);
    mockHistory.annotateWithChange.mockReturnValueOnce([]);

    const r = await service.compare({commodity: 'Tomato'});

    expect(r.rows).toEqual([]);
    expect(r.recommendation).toBeNull();
    expect(r.isDemo).toBe(true);
    expect(r.isDegraded).toBe(true);
    expect(typeof r.fetchedAt).toBe('string');
  });

  it('picks the highest-modalPrice mandi as the recommendation', async () => {
    mockRepo.findMany.mockResolvedValueOnce([
      {...baseRecord, market: 'Cheap Mandi', modalPrice: 1000},
      {...baseRecord, market: 'Premium Mandi', modalPrice: 2500},
      {...baseRecord, market: 'Mid Mandi', modalPrice: 1750},
    ]);
    mockHistory.annotateWithChange.mockImplementation((x: any) => x);

    const r = await service.compare({commodity: 'Tomato'});

    expect(r.recommendation).not.toBeNull();
    expect(r.recommendation!.market).toBe('Premium Mandi');
    expect(r.recommendation!.modalPrice).toBe(2500);
    expect(r.isDemo).toBe(false);
    expect(r.isDegraded).toBe(true);
  });

  it('recommendation carries score, breakdown, and reasons (5-factor contract)', async () => {
    mockRepo.findMany.mockResolvedValueOnce([
      {...baseRecord, market: 'Kolar Mandi', modalPrice: 1500},
      {...baseRecord, market: 'Mysore Mandi', modalPrice: 1700, state: 'Karnataka', district: 'Mysore'},
    ]);
    mockHistory.annotateWithChange.mockImplementation((x: any) => x);

    const r = await service.compare({commodity: 'Tomato'});

    expect(r.recommendation).not.toBeNull();
    const rec = r.recommendation!;
    expect(typeof rec.score).toBe('number');
    expect(rec.score).toBeGreaterThan(0);
    expect(rec.score).toBeLessThanOrEqual(100);
    expect(rec.breakdown).toBeDefined();
    expect(typeof rec.breakdown.netValue).toBe('number');
    expect(typeof rec.breakdown.distance).toBe('number');
    expect(typeof rec.breakdown.demand).toBe('number');
    expect(typeof rec.breakdown.paymentReliability).toBe('number');
    expect(typeof rec.breakdown.qualityMatch).toBe('number');
    expect(Array.isArray(rec.reasons)).toBe(true);
    expect(rec.reasons.length).toBeGreaterThan(0);
    expect(rec.reasons.length).toBeLessThanOrEqual(4);
  });

  it('dedupes rows by (state, market) keeping only the latest arrival date', async () => {
    mockRepo.findMany.mockResolvedValueOnce([
      {...baseRecord, market: 'Kolar Mandi', arrivalDate: '2026-04-10', modalPrice: 1300},
      {...baseRecord, market: 'Kolar Mandi', arrivalDate: '2026-04-15', modalPrice: 1500},
      {...baseRecord, market: 'Mysore Mandi', arrivalDate: '2026-04-15', modalPrice: 1700, district: 'Mysore'},
    ]);
    mockHistory.annotateWithChange.mockImplementation((x: any) => x);

    const r = await service.compare({commodity: 'Tomato'});

    expect(r.rows).toHaveLength(2);
    const kolar = r.rows.find(x => x.market === 'Kolar Mandi')!;
    expect(kolar.arrivalDate).toBe('2026-04-15');
    expect(kolar.modalPrice).toBe(1500);
  });

  it('a single mandi still scores and returns a recommendation', async () => {
    mockRepo.findMany.mockResolvedValueOnce([
      {...baseRecord, market: 'Solo Mandi', modalPrice: 1500},
    ]);
    mockHistory.annotateWithChange.mockImplementation((x: any) => x);

    const r = await service.compare({commodity: 'Tomato'});

    expect(r.rows).toHaveLength(1);
    expect(r.recommendation).not.toBeNull();
    expect(r.recommendation!.market).toBe('Solo Mandi');
    expect(r.recommendation!.breakdown.netValue).toBe(100);
  });
});

