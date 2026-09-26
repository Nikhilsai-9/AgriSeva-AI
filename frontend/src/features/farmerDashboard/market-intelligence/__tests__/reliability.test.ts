/**
 * PHASE 2 §P2.B — pure-function tests for `computeReliabilityScore` and
 * `reliabilityEvidence`.
 *
 * Scoring contract (reliability.ts):
 *   verifiedBonus   +20 (verificationStatus === "verified")
 *   ratingFactor    0..35   (rating / 5 * 35)
 *   dealsFactor     0..25   (logarithmic curve, capped at 200 deals)
 *   paymentFactor   0..20   (inversely proportional to NET-terms)
 *   disputeFactor   0..-20  (payment/quality grievances, max -20)
 *
 * RULE 11: if buyer.completedDeals < MIN_DEALS_FOR_RELIABILITY (3) the
 * function MUST return `null` (suppression — never a misleading low score).
 */
import {describe, it, expect} from 'vitest';
import {computeReliabilityScore, reliabilityEvidence} from '../reliability';
import {MIN_DEALS_FOR_RELIABILITY} from '../constants';
import type {Buyer, Grievance} from '../../types';

const buyer = (over: Partial<Buyer> = {}): Buyer => ({
  id: 'b-1',
  name: 'Test Buyer',
  rating: 4.5,
  completedDeals: 25,
  paymentTermsDays: 7,
  verificationStatus: 'verified',
  cropsInterested: ['Tomato'],
  ...over,
});

const grievance = (over: Partial<Grievance> = {}): Grievance => ({
  id: 'g-1',
  raisedBy: 'You',
  category: 'payment',
  status: 'open',
  transactionRef: 'b-1-tx-001',
  ...over,
});

describe('computeReliabilityScore — RULE 11 suppression', () => {
  it(`returns null when completedDeals < ${MIN_DEALS_FOR_RELIABILITY}`, () => {
    expect(computeReliabilityScore(buyer({completedDeals: 0}))).toBeNull();
    expect(computeReliabilityScore(buyer({completedDeals: 1}))).toBeNull();
    expect(computeReliabilityScore(buyer({completedDeals: 2}))).toBeNull();
  });

  it('returns a number (not null) at the threshold', () => {
    const score = computeReliabilityScore(
      buyer({completedDeals: MIN_DEALS_FOR_RELIABILITY}),
    );
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });

  it('throws no error with undefined grievances', () => {
    expect(() =>
      computeReliabilityScore(buyer({completedDeals: 10})),
    ).not.toThrow();
  });
});

describe('computeReliabilityScore — factor contributions', () => {
  it('verified buyer adds ~+20 vs unverified (everything else equal)', () => {
    const verified = computeReliabilityScore(
      buyer({verificationStatus: 'verified', completedDeals: 30}),
    );
    const unverified = computeReliabilityScore(
      buyer({verificationStatus: 'unverified', completedDeals: 30}),
    );
    expect(verified).not.toBeNull();
    expect(unverified).not.toBeNull();
    expect(verified!).toBeGreaterThan(unverified!);
    expect(verified! - unverified!).toBeGreaterThanOrEqual(15);
  });

  it('higher rating yields higher score', () => {
    const high = computeReliabilityScore(
      buyer({rating: 5, completedDeals: 30}),
    );
    const mid = computeReliabilityScore(
      buyer({rating: 3, completedDeals: 30}),
    );
    const low = computeReliabilityScore(
      buyer({rating: 1, completedDeals: 30}),
    );
    expect(high).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(low).not.toBeNull();
    expect(high!).toBeGreaterThan(mid!);
    expect(mid!).toBeGreaterThan(low!);
  });

  it('longer payment terms reduce the score (NET-30 worse than NET-1)', () => {
    const fast = computeReliabilityScore(
      buyer({paymentTermsDays: 1, completedDeals: 30}),
    );
    const slow = computeReliabilityScore(
      buyer({paymentTermsDays: 30, completedDeals: 30}),
    );
    expect(fast).not.toBeNull();
    expect(slow).not.toBeNull();
    expect(fast!).toBeGreaterThan(slow!);
  });

  it('disputes penalize the score (payment/quality only)', () => {
    const clean = computeReliabilityScore(buyer({completedDeals: 30}), []);
    const disputed = computeReliabilityScore(buyer({completedDeals: 30}), [
      grievance({id: 'g1', raisedBy: 'You', category: 'payment'}),
      grievance({id: 'g2', raisedBy: 'You', category: 'quality'}),
    ]);
    expect(clean).not.toBeNull();
    expect(disputed).not.toBeNull();
    expect(clean!).toBeGreaterThan(disputed!);
    // Two disputes = -10 (5 each) — allow some range due to rounding.
    expect(clean! - disputed!).toBeGreaterThanOrEqual(8);
    expect(clean! - disputed!).toBeLessThanOrEqual(12);
  });

  it('non-payment/non-quality grievances do NOT penalize', () => {
    const clean = computeReliabilityScore(buyer({completedDeals: 30}), []);
    const withOther = computeReliabilityScore(
      buyer({completedDeals: 30}),
      [grievance({category: 'logistics'})],
    );
    expect(clean).not.toBeNull();
    expect(withOther).toBe(clean);
  });

  it('score is clamped to [0, 100] even with extreme inputs', () => {
    const score = computeReliabilityScore(
      buyer({
        rating: 5,
        completedDeals: 1000,
        paymentTermsDays: 1,
        verificationStatus: 'verified',
      }),
      [],
    );
    expect(score).not.toBeNull();
    expect(score!).toBeLessThanOrEqual(100);
    expect(score!).toBeGreaterThanOrEqual(0);
  });
});

describe('reliabilityEvidence — companion helper', () => {
  it('suppressed buyer → suppressed: true, tierLabel mentions not-enough-deals', () => {
    const ev = reliabilityEvidence(buyer({completedDeals: 1}), []);
    expect(ev.suppressed).toBe(true);
    expect(ev.score).toBeNull();
    expect(ev.tierLabel).toMatch(/not enough/i);
  });

  it('normal buyer → evidence contains Verified and Rated chips', () => {
    const ev = reliabilityEvidence(buyer({completedDeals: 30}), []);
    expect(ev.suppressed).toBe(false);
    expect(ev.score).not.toBeNull();
    expect(ev.evidence.some((e) => e.label.includes('Verified'))).toBe(true);
    expect(ev.evidence.some((e) => e.label.includes('Rated'))).toBe(true);
    expect(
      ev.evidence.some((e) => e.label.includes('completed deals')),
    ).toBe(true);
  });

  it('disputes appear as a negative-tone chip', () => {
    const ev = reliabilityEvidence(buyer({completedDeals: 30}), [
      grievance({raisedBy: 'You', category: 'payment'}),
    ]);
    const negative = ev.evidence.find((e) => e.tone === 'negative');
    expect(negative).toBeDefined();
    expect(negative!.label).toMatch(/dispute/i);
  });
});
