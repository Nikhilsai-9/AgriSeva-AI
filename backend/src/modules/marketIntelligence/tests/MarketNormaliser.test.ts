/**
 * MarketNormaliser - pure-helper depth tests.
 *
 * P2.C scope:
 *   - `toFiniteNumber`, `toIsoDate`, `cleanString`, `buildRecordKey`
 *     and `todayIso` are exported pure helpers; we lock down their
 *     behaviour so future refactors cannot regress coercion logic.
 *   - `MarketNormaliser.normaliseAgmarknet` and `.normaliseEnam`
 *     must produce canonical records with correct shape, fall back
 *     gracefully on missing fields, and never fabricate prices.
 */

import {describe, expect, it} from 'vitest';

import {
  MarketNormaliser,
  buildRecordKey,
  cleanString,
  formatIstDate,
  toFiniteNumber,
  toIsoDate,
  todayIso,
} from '../services/MarketNormaliser.js';

describe('MarketNormaliser - toIsoDate (pure helper)', () => {
  it('accepts already-ISO YYYY-MM-DD strings', () => {
    expect(toIsoDate('2026-04-15')).toBe('2026-04-15');
  });

  it('truncates ISO timestamps to YYYY-MM-DD', () => {
    expect(toIsoDate('2026-04-15T10:30:00Z')).toBe('2026-04-15');
    expect(toIsoDate('2026-04-15T10:30:00.000Z')).toBe('2026-04-15');
  });

  it('parses dd/mm/yyyy and mm-dd-yyyy formats', () => {
    expect(toIsoDate('15/04/2026')).toBe('2026-04-15');
    expect(toIsoDate('04/05/2026')).toBe('2026-05-04');
    expect(toIsoDate('15-04-2026')).toBe('2026-04-15');
  });

  it('parses JS Date instances', () => {
    const d = new Date('2026-04-15T12:00:00Z');
    expect(toIsoDate(d)).toBe('2026-04-15');
  });

  it('returns undefined for empty / whitespace / garbage', () => {
    expect(toIsoDate('')).toBeUndefined();
    expect(toIsoDate('   ')).toBeUndefined();
    expect(toIsoDate('not-a-date')).toBeUndefined();
    expect(toIsoDate(null)).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
  });
});

describe('MarketNormaliser - cleanString (pure helper)', () => {
  it('trims and returns non-empty strings', () => {
    expect(cleanString('hello')).toBe('hello');
    expect(cleanString('  tomato  ')).toBe('tomato');
  });

  it('returns undefined for empty / whitespace-only strings', () => {
    expect(cleanString('')).toBeUndefined();
    expect(cleanString('   ')).toBeUndefined();
  });

  it('returns undefined for non-strings (numbers, null, objects)', () => {
    expect(cleanString(42)).toBeUndefined();
    expect(cleanString(null)).toBeUndefined();
    expect(cleanString(undefined)).toBeUndefined();
    expect(cleanString({})).toBeUndefined();
    expect(cleanString(['x'])).toBeUndefined();
  });
});

describe('MarketNormaliser - buildRecordKey (pure helper)', () => {
  it('produces a stable 32-char hex key for identical inputs', () => {
    const k1 = buildRecordKey({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
    });
    const k2 = buildRecordKey({
      source: 'agmarknet',
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
    });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is case-insensitive for state/market/commodity', () => {
    const lower = buildRecordKey({
      source: 'agmarknet',
      state: 'karnataka',
      market: 'kolar mandi',
      commodity: 'tomato',
      arrivalDate: '2026-04-15',
    });
    const upper = buildRecordKey({
      source: 'agmarknet',
      state: 'KARNATAKA',
      market: 'KOLAR MANDI',
      commodity: 'TOMATO',
      arrivalDate: '2026-04-15',
    });
    expect(lower).toBe(upper);
  });

  it('produces distinct keys for different sources (agmarknet vs enam)', () => {
    const base = {
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
      arrivalDate: '2026-04-15',
    };
    const ag = buildRecordKey({source: 'agmarknet', ...base});
    const en = buildRecordKey({source: 'enam', ...base});
    expect(ag).not.toBe(en);
  });

  it('produces distinct keys for different arrival dates', () => {
    const base = {
      source: 'agmarknet' as const,
      state: 'Karnataka',
      market: 'Kolar Mandi',
      commodity: 'Tomato',
    };
    const d1 = buildRecordKey({...base, arrivalDate: '2026-04-15'});
    const d2 = buildRecordKey({...base, arrivalDate: '2026-04-16'});
    expect(d1).not.toBe(d2);
  });
});

describe('MarketNormaliser - todayIso() (pure-ish helper)', () => {
  it('returns a YYYY-MM-DD string for today', () => {
    const today = todayIso();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // PHASE 2 §P2.E — compare against IST, not UTC.
    expect(today).toBe(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(new Date())
        .replace(/\//g, '-'),
    );
  });
});

describe('MarketNormaliser - todayIso / formatIstDate (PHASE 2 §P2.E)', () => {
  it('formatIstDate rolls into the next IST day for late UTC instants', () => {
    // 2025-03-14 18:30 UTC == 2025-03-15 00:00 IST
    const utcLate = new Date('2025-03-14T18:30:00.000Z');
    expect(formatIstDate(utcLate)).toBe('2025-03-15');
  });

  it('formatIstDate keeps the same day for mid-IST instants', () => {
    // 2025-03-14 09:00 IST == 2025-03-14 03:30 UTC
    const utcMorning = new Date('2025-03-14T03:30:00.000Z');
    expect(formatIstDate(utcMorning)).toBe('2025-03-14');
  });

  it('formatIstDate returns YYYY-MM-DD with zero-padded month and day', () => {
    // 2025-01-05 05:30 UTC == 2025-01-05 11:00 IST
    const t = new Date('2025-01-05T05:30:00.000Z');
    expect(formatIstDate(t)).toBe('2025-01-05');
  });

  it('todayIso() and Intl-derived IST date always agree', () => {
    // Run a few times to catch edge cases near the boundary.
    for (let i = 0; i < 3; i += 1) {
      const now = new Date(Date.now() + i * 1000);
      const expected = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(now)
        .replace(/\//g, '-');
      expect(formatIstDate(now)).toBe(expected);
    }
  });

  it('buildRecord stamps timezone = Asia/Kolkata', () => {
    const svc = new MarketNormaliser();
    const rec = svc.buildRecord({
      source: 'agmarknet',
      sourceSystem: 'Agmarknet',
      commodity: 'Tomato',
      market: 'Kolar Mandi',
      state: 'Karnataka',
      unit: '₹/quintal',
      arrivalDate: '2026-04-15',
    });
    expect(rec).not.toBeNull();
    expect(rec!.timezone).toBe('Asia/Kolkata');
    expect(rec!.arrivalDate).toBe('2026-04-15');
  });
});

describe('MarketNormaliser - normaliseAgmarknet (service)', () => {
  const svc = new MarketNormaliser();

  it('returns [] for null/undefined payloads', () => {
    expect(svc.normaliseAgmarknet(null, '2026-04-15')).toEqual([]);
    expect(svc.normaliseAgmarknet(undefined, '2026-04-15')).toEqual([]);
  });

  it('returns [] for empty payload shapes (records / data.records / bare array)', () => {
    expect(svc.normaliseAgmarknet({records: []}, '2026-04-15')).toEqual([]);
    expect(svc.normaliseAgmarknet({data: {records: []}}, '2026-04-15')).toEqual([]);
    expect(svc.normaliseAgmarknet({data: []}, '2026-04-15')).toEqual([]);
    expect(svc.normaliseAgmarknet([], '2026-04-15')).toEqual([]);
  });

  it('builds a canonical record from a marketwise_price_arrival_dynamic row', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Tomato',
          mkt_name: 'Kolar Mandi',
          state_name: 'Karnataka',
          arrival_date: '15/04/2026',
          min_price: '1,200',
          max_price: '1,800',
          modal_price: '1,500',
        },
      ],
    };
    const [r] = svc.normaliseAgmarknet(payload, '2026-04-15', 'https://agmarknet.gov.in');
    expect(r.commodity).toBe('Tomato');
    expect(r.market).toBe('Kolar Mandi');
    expect(r.state).toBe('Karnataka');
    expect(r.minPrice).toBe(1200);
    expect(r.maxPrice).toBe(1800);
    expect(r.modalPrice).toBe(1500);
    expect(r.unit).toBe('₹/quintal');
    expect(r.arrivalDate).toBe('2026-04-15');
    expect(r.source).toBe('agmarknet');
    expect(r.sourceSystem).toBe('Agmarknet');
    expect(r.sourceUrl).toBe('https://agmarknet.gov.in');
    expect(r.fetchStatus).toBe('live');
    expect(r.isAggregate).toBeUndefined();
  });

  it('skips rows missing commodity, market or state', () => {
    const payload = {
      records: [
        {cmdt_name: '', mkt_name: 'X', state_name: 'Y', arrival_date: '2026-04-15'},
        {cmdt_name: 'Tomato', mkt_name: '', state_name: 'Y', arrival_date: '2026-04-15'},
        {cmdt_name: 'Tomato', mkt_name: 'X', state_name: '', arrival_date: '2026-04-15'},
      ],
    };
    expect(svc.normaliseAgmarknet(payload, '2026-04-15')).toEqual([]);
  });

  it('never fabricates prices - missing price fields stay undefined', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Onion',
          mkt_name: 'Lasalgaon',
          state_name: 'Maharashtra',
          arrival_date: '2026-04-15',
          min_price: '900',
          modal_price: '1,100',
        },
      ],
    };
    const [r] = svc.normaliseAgmarknet(payload, '2026-04-15');
    expect(r.minPrice).toBe(900);
    expect(r.modalPrice).toBe(1100);
    expect(r.maxPrice).toBeUndefined();
  });

  it('preserves isAggregate provenance tag for state-level rows', () => {
    const payload = {
      data: [
        {
          cmdt_name: 'Wheat',
          mkt_name: 'Madhya Pradesh',
          state_name: 'Madhya Pradesh',
          arrival_date: '2026-04-15',
          modal_price: '2,400',
          isAggregate: true,
        },
      ],
    };
    const [r] = svc.normaliseAgmarknet(payload, '2026-04-15');
    expect(r.isAggregate).toBe(true);
  });

  it('falls back to fallbackDate when arrival_date is missing', () => {
    const payload = {
      records: [
        {
          cmdt_name: 'Rice',
          mkt_name: 'Karnal',
          state_name: 'Haryana',
          modal_price: '3,200',
        },
      ],
    };
    const [r] = svc.normaliseAgmarknet(payload, '2026-03-01');
    expect(r.arrivalDate).toBe('2026-03-01');
  });
});

describe('MarketNormaliser - normaliseEnam (service)', () => {
  const svc = new MarketNormaliser();

  it('returns [] for null / empty / unknown payloads', () => {
    expect(svc.normaliseEnam(null)).toEqual([]);
    expect(svc.normaliseEnam({})).toEqual([]);
    expect(svc.normaliseEnam({trade_data: []})).toEqual([]);
    expect(svc.normaliseEnam({data: []})).toEqual([]);
  });

  it('normalises a standard eNAM trade_data row with PascalCase keys', () => {
    const payload = {
      state: 'Maharashtra',
      apmc: 'Lasalgaon',
      commodity: 'Onion',
      trade_data: [
        {
          Commodity: 'Onion',
          APMC: 'Lasalgaon',
          State: 'Maharashtra',
          'Price Date': '2026-04-15',
          'Min Price': '900',
          'Max Price': '1,300',
          'Modal Price': '1,100',
        },
      ],
    };
    const [r] = svc.normaliseEnam(payload);
    expect(r.commodity).toBe('Onion');
    expect(r.market).toBe('Lasalgaon');
    expect(r.state).toBe('Maharashtra');
    expect(r.minPrice).toBe(900);
    expect(r.maxPrice).toBe(1300);
    expect(r.modalPrice).toBe(1100);
    expect(r.arrivalDate).toBe('2026-04-15');
    expect(r.source).toBe('enam');
    expect(r.sourceSystem).toBe('eNAM');
  });

  it('falls back to meta-level state/apmc/commodity when row fields are missing', () => {
    const payload = {
      state: 'Gujarat',
      apmc: 'Rajkot',
      commodity: 'Groundnut',
      trade_data: [
        {
          'Price Date': '2026-04-15',
          'Modal Price': '5,500',
        },
      ],
    };
    const [r] = svc.normaliseEnam(payload);
    expect(r.commodity).toBe('Groundnut');
    expect(r.market).toBe('Rajkot');
    expect(r.state).toBe('Gujarat');
    expect(r.modalPrice).toBe(5500);
  });

  it('skips rows where commodity, market and state are all missing (no meta fallback)', () => {
    // Without meta AND without row identifiers, the row cannot be placed.
    const payload = {
      trade_data: [{'Modal Price': '5,500'}],
    };
    expect(svc.normaliseEnam(payload)).toEqual([]);
  });

  it('defaults arrivalDate to todayIso() when price date and meta date are missing', () => {
    const today = todayIso();
    const payload = {
      trade_data: [
        {
          Commodity: 'Onion',
          APMC: 'Lasalgaon',
          State: 'Maharashtra',
          'Modal Price': '1,100',
        },
      ],
    };
    const [r] = svc.normaliseEnam(payload);
    expect(r.arrivalDate).toBe(today);
  });

  it('buildRecord() returns null when commodity, market or state is missing', () => {
    expect(
      svc.buildRecord({
        source: 'agmarknet',
        sourceSystem: 'Agmarknet',
        commodity: '',
        market: 'X',
        state: 'Y',
        unit: '₹/quintal',
        arrivalDate: '2026-04-15',
      }),
    ).toBeNull();
    expect(
      svc.buildRecord({
        source: 'agmarknet',
        sourceSystem: 'Agmarknet',
        commodity: 'Tomato',
        market: '',
        state: 'Y',
        unit: '₹/quintal',
        arrivalDate: '2026-04-15',
      }),
    ).toBeNull();
    expect(
      svc.buildRecord({
        source: 'agmarknet',
        sourceSystem: 'Agmarknet',
        commodity: 'Tomato',
        market: 'X',
        state: '',
        unit: '₹/quintal',
        arrivalDate: '2026-04-15',
      }),
    ).toBeNull();
  });
});

describe('MarketNormaliser - toFiniteNumber (pure helper)', () => {
  it('returns the value unchanged for finite numbers', () => {
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(42)).toBe(42);
    expect(toFiniteNumber(-1.5)).toBe(-1.5);
  });

  it('returns undefined for null and undefined', () => {
    expect(toFiniteNumber(null)).toBeUndefined();
    expect(toFiniteNumber(undefined)).toBeUndefined();
  });

  it('returns undefined for non-finite numbers (NaN, Infinity)', () => {
    expect(toFiniteNumber(NaN)).toBeUndefined();
    expect(toFiniteNumber(Infinity)).toBeUndefined();
    expect(toFiniteNumber(-Infinity)).toBeUndefined();
  });

  it('parses simple numeric strings', () => {
    expect(toFiniteNumber('1234')).toBe(1234);
    expect(toFiniteNumber('12.50')).toBe(12.5);
    expect(toFiniteNumber('-7')).toBe(-7);
  });

  it('strips commas, spaces and rupee symbols commonly found in scraped data', () => {
    expect(toFiniteNumber('1,200')).toBe(1200);
    expect(toFiniteNumber('1,23,456')).toBe(123456);
    expect(toFiniteNumber('  1500  ')).toBe(1500);
  });

  it('returns undefined for empty / whitespace / non-numeric strings', () => {
    expect(toFiniteNumber('')).toBeUndefined();
    expect(toFiniteNumber('   ')).toBeUndefined();
    expect(toFiniteNumber('abc')).toBeUndefined();
    expect(toFiniteNumber('Rs.100')).toBeUndefined();
  });

  it('returns undefined for booleans / objects / arrays (no coercion)', () => {
    expect(toFiniteNumber(true)).toBeUndefined();
    expect(toFiniteNumber(false)).toBeUndefined();
    expect(toFiniteNumber({})).toBeUndefined();
    expect(toFiniteNumber([1])).toBeUndefined();
  });
});
