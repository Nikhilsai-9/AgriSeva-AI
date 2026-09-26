/**
 * PHASE 2 §P2.B — pure-function tests for `computeRealisableValue`.
 *
 * Formula under test (from realisable-value.ts):
 *   gross     = (modalPrice/quintal) * (lot.quantityKg / 100)
 *   transport = distanceKm * costPerKm
 *   loading   = loadingPerKg * lot.quantityKg
 *   unloading = unloadingPerKg * lot.quantityKg
 *   marketFee = marketFeePct * gross
 *   insurance = insurancePct * gross
 *   other     = otherFlat
 *   realisable = max(0, gross − Σ(breakdown))
 */
import {describe, it, expect} from 'vitest';
import {
  computeRealisableValue,
  deriveIsDemo,
  realisableValueLines,
} from '../realisable-value';
import type {FarmerLot, MarketPrice} from '../../types';

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
  modalPrice: 2000, // ₹/quintal
  minPrice: 1800,
  maxPrice: 2200,
  arrivalDate: new Date('2026-09-26T00:00:00Z'),
  source: 'agmarknet',
  ...over,
});

describe('computeRealisableValue — happy path', () => {
  it('100 kg at ₹2000/quintal → ₹2000 gross, no logistics, net = gross (just fees subtracted)', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 100}),
      price: price({modalPrice: 2000}),
    });
    // 2000/100 = ₹20/kg × 100kg = ₹2000 gross
    expect(rv.gross).toBe(2000);
    expect(rv.pricePerKg).toBe(20);
    expect(rv.quantityKg).toBe(100);
    // Default logistics: marketFee 1% + insurance 0.5% + other ₹50 + loading/unloading 0.5 ₹/kg
    // Fees on ₹2000 = ₹20 + ₹10 = ₹30; otherFlat = ₹50; loading+unloading on 100kg = ₹50
    // So deductions = 30 + 50 + 50 = ₹130, net = ₹1870.
    expect(rv.net).toBeGreaterThan(0);
    expect(rv.net).toBeLessThanOrEqual(rv.gross);
    // net = gross − breakdown.total
    expect(rv.net).toBeCloseTo(rv.gross - rv.breakdown.total, 6);
  });

  it('higher distance + higher costPerKm reduces net (transport is a deduction)', () => {
    const close = computeRealisableValue({
      lot: lot(),
      price: price(),
      logistics: {distanceKm: 10, costPerKm: 5}, // ₹50 transport
    });
    const far = computeRealisableValue({
      lot: lot(),
      price: price(),
      logistics: {distanceKm: 200, costPerKm: 5}, // ₹1000 transport
    });
    expect(far.breakdown.transport).toBeGreaterThan(close.breakdown.transport);
    expect(far.net).toBeLessThan(close.net);
    expect(far.netPerKg).toBeLessThan(close.netPerKg);
  });

  it('loading/unloading scale linearly with lot quantity', () => {
    const small = computeRealisableValue({
      lot: lot({quantityKg: 50}),
      price: price({modalPrice: 2000}),
    });
    const large = computeRealisableValue({
      lot: lot({quantityKg: 200}),
      price: price({modalPrice: 2000}),
    });
    expect(large.breakdown.loading).toBe(small.breakdown.loading * 4);
    expect(large.breakdown.unloading).toBe(small.breakdown.unloading * 4);
  });

  it('marketFeePct and insurancePct are computed on gross', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 100}),
      price: price({modalPrice: 1000}), // gross = ₹1000
      logistics: {marketFeePct: 0.05, insurancePct: 0.02},
    });
    expect(rv.gross).toBe(1000);
    expect(rv.breakdown.marketFee).toBe(50); // 5% of 1000
    expect(rv.breakdown.insurance).toBe(20); // 2% of 1000
  });
});

describe('computeRealisableValue — degenerate inputs', () => {
  it('quantityKg = 0 → net = 0, no NaN', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 0}),
      price: price(),
    });
    expect(rv.quantityKg).toBe(0);
    expect(rv.gross).toBe(0);
    expect(rv.net).toBe(0);
    expect(rv.netPerKg).toBe(0);
    expect(Number.isFinite(rv.breakdown.total)).toBe(true);
    expect(Number.isNaN(rv.net)).toBe(false);
  });

  it('negative quantityKg is clamped to 0 (defensive — must not fabricate negative revenue)', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: -50}),
      price: price(),
    });
    expect(rv.quantityKg).toBe(0);
    expect(rv.net).toBe(0);
  });

  it('breakdown.total = gross ⇒ net = 0 (never negative)', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 100}),
      price: price({modalPrice: 10}), // gross = ₹10
      logistics: {distanceKm: 100, costPerKm: 50, otherFlat: 10_000}, // absurd costs
    });
    expect(rv.net).toBe(0);
    expect(Number.isFinite(rv.net)).toBe(true);
  });
});

describe('computeRealisableValue — derivation correctness', () => {
  it('price.modalPrice / KG_PER_QUINTAL === pricePerKg', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 250}),
      price: price({modalPrice: 2400}),
    });
    expect(rv.pricePerKg).toBe(24);
  });

  it('gross === pricePerKg × quantityKg', () => {
    const rv = computeRealisableValue({
      lot: lot({quantityKg: 333}),
      price: price({modalPrice: 3000}),
    });
    expect(rv.gross).toBeCloseTo(rv.pricePerKg * rv.quantityKg, 6);
  });
});

describe('realisableValueLines — formatting helper', () => {
  it('returns exactly 8 lines (gross / 6 deductions / net)', () => {
    const rv = computeRealisableValue({lot: lot(), price: price()});
    expect(realisableValueLines(rv)).toHaveLength(8);
  });

  it('flags gross and net as non-deductions', () => {
    const rv = computeRealisableValue({lot: lot(), price: price()});
    const lines = realisableValueLines(rv);
    const nonDeductions = lines.filter((l) => !l.isDeduction);
    expect(nonDeductions).toHaveLength(2);
    expect(nonDeductions.map((l) => l.label)).toEqual([
      'Gross (modal price × qty)',
      'Net realisable',
    ]);
  });
});

describe('deriveIsDemo — PHASE 2 §P2.G single source of truth', () => {
  it('agmarknet price is NOT demo', () => {
    expect(deriveIsDemo({source: 'agmarknet'})).toBe(false);
  });

  it('eNAM price is NOT demo', () => {
    expect(deriveIsDemo({source: 'enam'})).toBe(false);
  });

  it('explicit demo source IS demo', () => {
    expect(deriveIsDemo({source: 'demo'})).toBe(true);
  });

  it('uppercase DEMO is case-insensitive and still demo', () => {
    expect(deriveIsDemo({source: 'DEMO'})).toBe(true);
  });

  it('missing source is treated as demo (legacy fixtures)', () => {
    expect(deriveIsDemo({})).toBe(true);
    expect(deriveIsDemo({source: undefined})).toBe(true);
  });

  it('null / undefined price is treated as demo', () => {
    expect(deriveIsDemo(null)).toBe(true);
    expect(deriveIsDemo(undefined)).toBe(true);
  });
});

describe('computeRealisableValue — isDemo derivation (PHASE 2 §P2.G)', () => {
  it('agmarknet price → isDemo = false (was hardcoded true)', () => {
    const rv = computeRealisableValue({
      lot: lot(),
      price: price({source: 'agmarknet'}),
    });
    expect(rv.isDemo).toBe(false);
  });

  it('eNAM price → isDemo = false', () => {
    const rv = computeRealisableValue({
      lot: lot(),
      price: price({source: 'enam'}),
    });
    expect(rv.isDemo).toBe(false);
  });

  it('demo source → isDemo = true', () => {
    const rv = computeRealisableValue({
      lot: lot(),
      price: price({source: 'demo'}),
    });
    expect(rv.isDemo).toBe(true);
  });

  it('price with no source field → isDemo = true (legacy fixture safety)', () => {
    const legacyPrice = price();
    delete (legacyPrice as Partial<MarketPrice>).source;
    const rv = computeRealisableValue({lot: lot(), price: legacyPrice});
    expect(rv.isDemo).toBe(true);
  });
});
