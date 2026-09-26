/**
 * PHASE 2 §P2.B — pure-function tests for `recommendBestMarketForLot`.
 *
 * Validates:
 *   • Pure determinism — same input → same output.
 *   • Returns [] when no prices match the lot crop.
 *   • Results are sorted by score descending.
 *   • Sub-scores are clamped to 0..100 (no negatives).
 *   • Buyer matching: best buyer per market = closest that grows the crop.
 *   • Top candidate has `reasons` array of 4 strings (or fewer if some
 *     carry 0 impact, but always ≤ 5).
 *   • When buyers array is absent, `buyer` is null on every candidate.
 *
 * Companion: `sourceLabel` truthfulness branches per PHASE 1 §P2.7.
 */
import {describe, it, expect} from 'vitest';
import {
  recommendBestMarketForLot,
  sourceLabel,
} from '../recommendation';
import {MIN_DEALS_FOR_RELIABILITY} from '../constants';
import type {Buyer, FarmerLot, MarketPrice} from '../../types';

const lot = (over: Partial<FarmerLot> = {}): FarmerLot => ({
  id: 'lot-1',
  crop: 'Tomato',
  quantityKg: 100,
  qualityGrade: 'A',
  village: 'Test Village',
  ...over,
});

const price = (over: Partial<MarketPrice> = {}): MarketPrice => ({
  id: 'p-1',
  commodity: 'Tomato',
  market: 'Azadpur Mandi',
  state: 'Delhi',
  modalPrice: 2000,
  arrivalDate: new Date('2026-09-26T00:00:00Z'),
  source: 'agmarknet',
  distanceKm: 25,
  ...over,
});

const buyer = (over: Partial<Buyer> = {}): Buyer => ({
  id: 'b-1',
  name: 'Test Buyer',
  rating: 4.5,
  completedDeals: MIN_DEALS_FOR_RELIABILITY + 5,
  paymentTermsDays: 7,
  verificationStatus: 'verified',
  cropsInterested: ['Tomato'],
  distanceKm: 10,
  minQuantityKg: 50,
  maxQuantityKg: 500,
  ...over,
});

describe('recommendBestMarketForLot — invocation rules', () => {
  it('returns [] when no prices match the lot crop (case-insensitive)', () => {
    expect(
      recommendBestMarketForLot({
        lot: lot({crop: 'Onion'}),
        prices: [price({commodity: 'Tomato'})],
      }),
    ).toEqual([]);
  });

  it('returns [] when prices array is empty', () => {
    expect(recommendBestMarketForLot({lot: lot(), prices: []})).toEqual([]);
  });

  it('filters out prices with mismatched commodity', () => {
    const out = recommendBestMarketForLot({
      lot: lot({crop: 'Tomato'}),
      prices: [
        price({id: 'p1', commodity: 'Onion'}),
        price({id: 'p2', commodity: 'Tomato', modalPrice: 1500}),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].price.id).toBe('p2');
  });

  it('always returns candidates sorted by score DESC', () => {
    const cheap = price({id: 'p1', modalPrice: 1500, distanceKm: 100});
    const far = price({id: 'p2', modalPrice: 2500, distanceKm: 100});
    const close = price({id: 'p3', modalPrice: 1800, distanceKm: 5});

    const out = recommendBestMarketForLot({
      lot: lot(),
      prices: [cheap, far, close],
    });
    expect(out).toHaveLength(3);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });
});

describe('recommendBestMarketForLot — sub-score clamping', () => {
  it('all sub-scores in 0..100 and final score is an integer', () => {
    const out = recommendBestMarketForLot({
      lot: lot(),
      prices: [
        price({id: 'p1', modalPrice: 1800, distanceKm: 50}),
        price({id: 'p2', modalPrice: 2200, distanceKm: 150, source: 'enam'}),
      ],
    });
    for (const c of out) {
      for (const k of ['netValue', 'distance', 'demand', 'paymentReliability', 'qualityMatch'] as const) {
        expect(c.breakdown[k]).toBeGreaterThanOrEqual(0);
        expect(c.breakdown[k]).toBeLessThanOrEqual(100);
      }
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(c.score)).toBe(true);
    }
  });
});

describe('recommendBestMarketForLot — buyer matching', () => {
  it('candidate.buyer is null when buyers array is omitted', () => {
    const out = recommendBestMarketForLot({
      lot: lot(),
      prices: [price()],
    });
    expect(out[0].buyer).toBeNull();
  });

  it('candidate.buyer resolves to a buyer who grows the lot crop', () => {
    const matchingBuyer = buyer({id: 'b-grower', cropsInterested: ['Tomato'], distanceKm: 25});
    const otherBuyer = buyer({
      id: 'b-other',
      cropsInterested: ['Mango'],
      distanceKm: 1,
    });
    const out = recommendBestMarketForLot({
      lot: lot({crop: 'Tomato', quantityKg: 100}),
      prices: [price({id: 'p1', distanceKm: 50})],
      buyers: [otherBuyer, matchingBuyer],
    });
    expect(out[0].buyer).not.toBeNull();
    expect(out[0].buyer!.id).toBe('b-grower');
  });

  it('falls back to closest buyer if none grow the crop', () => {
    const mangoBuyer = buyer({id: 'b-m', cropsInterested: ['Mango'], distanceKm: 5});
    const onionBuyer = buyer({id: 'b-o', cropsInterested: ['Onion'], distanceKm: 50});
    const out = recommendBestMarketForLot({
      lot: lot({crop: 'Tomato'}),
      prices: [price()],
      buyers: [onionBuyer, mangoBuyer],
    });
    expect(out[0].buyer).not.toBeNull();
    expect(out[0].buyer!.id).toBe('b-m');
  });
});

describe('recommendBestMarketForLot — reasons and determinism', () => {
  it('top candidate has at most 5 reason strings', () => {
    const out = recommendBestMarketForLot({
      lot: lot(),
      prices: [price({id: 'p1', modalPrice: 2000, distanceKm: 25})],
      buyers: [buyer({distanceKm: 20})],
    });
    expect(out[0].reasons.length).toBeGreaterThan(0);
    expect(out[0].reasons.length).toBeLessThanOrEqual(5);
  });

  it('returns deterministic output for the same input', () => {
    const input = {
      lot: lot(),
      prices: [
        price({id: 'p1', modalPrice: 2000, distanceKm: 25}),
        price({id: 'p2', modalPrice: 1800, distanceKm: 80}),
      ],
      buyers: [buyer()],
    };
    const a = recommendBestMarketForLot(input);
    const b = recommendBestMarketForLot(input);
    expect(a[0].score).toBe(b[0].score);
    expect(a[0].reasons).toEqual(b[0].reasons);
  });
});

describe('sourceLabel — truthfulness branches (PHASE 1 §P2.7)', () => {
  it('undefined price → "Unknown source"', () => {
    expect(sourceLabel(undefined)).toBe('Unknown source');
  });

  it('agmarknet family → "Agmarknet (data.gov.in)"', () => {
    expect(sourceLabel(price({source: 'agmarknet'}))).toBe(
      'Agmarknet (data.gov.in)',
    );
    expect(sourceLabel(price({source: 'mcp-agmarknet'}))).toBe(
      'Agmarknet (data.gov.in)',
    );
  });

  it('enam family → "eNAM"', () => {
    expect(sourceLabel(price({source: 'enam'}))).toBe('eNAM');
    expect(sourceLabel(price({source: 'mcp-enam'}))).toBe('eNAM');
  });

  it('empty source → "Demo" (legacy fallback — NEVER claim real data is demo)', () => {
    expect(sourceLabel(price({source: ''}))).toBe('Demo');
  });

  it('unknown source id → "Source: <id>" (NEVER silent "Demo")', () => {
    expect(sourceLabel(price({source: 'made_up_id'}))).toBe(
      'Source: made_up_id',
    );
  });
});

