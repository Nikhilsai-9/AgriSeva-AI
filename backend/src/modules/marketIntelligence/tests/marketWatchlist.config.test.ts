/**
 * PHASE 1 §P1.3 — Watchlist coverage contract.
 *
 * These tests assert the structural promise of the new tiered
 * watchlist: every commodity the farmer UI advertises is covered,
 * every tier is populated, and the data the ingestion service
 * consumes is derived consistently from the human-readable config.
 */

import {describe, it, expect} from 'vitest';
import {
  MARKET_WATCHLIST,
  MARKET_WATCHLIST_TARGETS,
  WATCHLIST_TOTAL,
  countByTier,
} from '../config/marketWatchlist.config.js';

const ADVERTISED_COMMODITIES = [
  'Tomato',
  'Onion',
  'Potato',
  'Rice',
  'Wheat',
  'Maize',
  'Cotton',
  'Sugarcane',
  'Groundnut',
  'Soybean',
  'Turmeric',
  'Chilli',
  'Coriander',
  'Cumin',
  'Black Gram',
  'Green Gram',
  'Pigeon Pea',
  'Mustard',
];

describe('PHASE 1 §P1.3 — market watchlist config', () => {
  it('covers every commodity advertised in the FE COMMODITIES list', () => {
    const covered = new Set(MARKET_WATCHLIST.map(e => e.commodity));
    for (const c of ADVERTISED_COMMODITIES) {
      expect(covered.has(c)).toBe(true);
    }
  });

  it('has at least 18 unique commodities (no silent gaps)', () => {
    expect(MARKET_WATCHLIST.length).toBeGreaterThanOrEqual(18);
    const unique = new Set(MARKET_WATCHLIST.map(e => e.commodity));
    expect(unique.size).toBe(MARKET_WATCHLIST.length);
  });

  it('populates all three tiers', () => {
    expect(countByTier('HIGH')).toBeGreaterThan(0);
    expect(countByTier('MEDIUM')).toBeGreaterThan(0);
    expect(countByTier('LOW')).toBeGreaterThan(0);
  });

  it('keeps HIGH tier strictly smaller than MEDIUM', () => {
    expect(countByTier('HIGH')).toBeLessThan(countByTier('MEDIUM'));
  });

  it('assigns HIGH tier to perishables / vegetables', () => {
    const high = MARKET_WATCHLIST.filter(e => e.tier === 'HIGH').map(
      e => e.commodity,
    );
    expect(high).toContain('Tomato');
    expect(high).toContain('Onion');
    expect(high).toContain('Potato');
  });

  it('assigns LOW tier to slow-moving spices + cash crops', () => {
    const low = MARKET_WATCHLIST.filter(e => e.tier === 'LOW').map(
      e => e.commodity,
    );
    expect(low).toContain('Sugarcane');
    expect(low).toContain('Turmeric');
    expect(low).toContain('Coriander');
    expect(low).toContain('Cumin');
  });

  it('refreshHours is strictly positive and ≤ 24', () => {
    for (const e of MARKET_WATCHLIST) {
      expect(e.refreshHours).toBeGreaterThan(0);
      expect(e.refreshHours).toBeLessThanOrEqual(24);
    }
  });

  it('HIGH refreshes at least as fast as MEDIUM (which refreshes at least as fast as LOW)', () => {
    const high = MARKET_WATCHLIST.filter(e => e.tier === 'HIGH');
    const med = MARKET_WATCHLIST.filter(e => e.tier === 'MEDIUM');
    const low = MARKET_WATCHLIST.filter(e => e.tier === 'LOW');

    const minOf = (arr: typeof high) =>
      Math.min(...arr.map(e => e.refreshHours));

    expect(minOf(high)).toBeLessThanOrEqual(minOf(med));
    expect(minOf(med)).toBeLessThanOrEqual(minOf(low));
  });

  it('emits a TARGETS list with one entry per commodity, in priority order', () => {
    expect(MARKET_WATCHLIST_TARGETS.length).toBe(MARKET_WATCHLIST.length);
    for (let i = 0; i < MARKET_WATCHLIST_TARGETS.length; i++) {
      expect(MARKET_WATCHLIST_TARGETS[i].commodity).toBe(
        MARKET_WATCHLIST[i].commodity,
      );
      expect(MARKET_WATCHLIST_TARGETS[i].limit).toBe(MARKET_WATCHLIST[i].limit);
    }
  });

  it('exposes a WATCHLIST_TOTAL count matching the array length', () => {
    expect(WATCHLIST_TOTAL).toBe(MARKET_WATCHLIST.length);
  });
});
