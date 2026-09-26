/**
 * SeedLoader — production-safety guard tests.
 *
 * The Farmer Dashboard ships with a SeedLoader that, on first access,
 * writes a fixed catalog of *fictional* records into the live MongoDB
 * (buyers, logistics_options, storage_options, payments, lots, offers,
 * grievances). In production this would silently present seeded
 * fiction as real application data.
 *
 * Contract being pinned:
 *   A. Default (no env var)   → ensureSeeded() is a no-op.
 *   B. ENABLE_DEMO_SEEDING="false" → same as A.
 *   C. ENABLE_DEMO_SEEDING="true"  → seeding runs.
 *   D. VITE_ENABLE_MOCKS is NOT consulted.
 *   E. Idempotent log spam protection.
 *   F. All 7 collections gated together.
 */

import 'reflect-metadata';
import {beforeEach, describe, expect, it, vi, afterEach} from 'vitest';

import {SeedLoader} from '../services/SeedLoader.js';
import {BuyerRepository} from '../repositories/BuyerRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {OfferRepository} from '../repositories/OfferRepository.js';
import {PaymentRepository} from '../repositories/PaymentRepository.js';
import {GrievanceRepository} from '../repositories/GrievanceRepository.js';
import {StorageRepository} from '../repositories/StorageRepository.js';
import {LogisticsRepository} from '../repositories/LogisticsRepository.js';

import {
  isDemoSeedingEnabled,
  getDemoSeedingDecision,
  _resetDemoSeedingDecision,
} from '../../../config/demoSeeding.js';

import {
  DEMO_BUYERS,
  DEMO_LOTS,
  DEMO_OFFERS,
  DEMO_PAYMENTS,
  DEMO_GRIEVANCES,
  DEMO_STORAGE_OPTIONS,
  DEMO_LOGISTICS_OPTIONS,
} from '../seed/demoData.js';
// Repository mocks — every write/read method is a vi.fn so we can
// assert it was never called when seeding is disabled.
const buyersMock = {
  count: vi.fn(async () => 0),
  upsertMany: vi.fn(async () => undefined),
  findMany: vi.fn(async () => [] as unknown[]),
  findById: vi.fn(async () => null),
  updateVerificationStatus: vi.fn(async () => null),
};

const lotsMock = {
  findMany: vi.fn(async () => [] as unknown[]),
  findById: vi.fn(async () => null),
  findByIdForFarmer: vi.fn(async () => null),
  upsert: vi.fn(async () => undefined),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => null),
  updateStatus: vi.fn(async () => null),
};

const offersMock = {
  findMany: vi.fn(async () => [] as unknown[]),
  findById: vi.fn(async () => null),
  findByLot: vi.fn(async () => []),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => null),
  updateStatus: vi.fn(async () => null),
  transition: vi.fn(async () => null),
  transitionCountered: vi.fn(async () => null),
  rejectSiblings: vi.fn(async () => 0),
  counterOffer: vi.fn(async () => ({original: null, counter: null})),
  withdraw: vi.fn(async () => null),
  reject: vi.fn(async () => null),
  upsert: vi.fn(async () => undefined),
};

const paymentsMock = {
  findMany: vi.fn(async () => [] as unknown[]),
  findById: vi.fn(async () => null),
  findActiveByLot: vi.fn(async () => null),
  insert: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => null),
  upsert: vi.fn(async () => undefined),
};

const grievancesMock = {
  findMany: vi.fn(async () => [] as unknown[]),
  findById: vi.fn(async () => null),
  insert: vi.fn(async () => undefined),
  update: vi.fn(async () => null),
  transition: vi.fn(async () => null),
  upsert: vi.fn(async () => undefined),
};

const storageMock = {
  findAllOptions: vi.fn(async () => [] as unknown[]),
  findOptionById: vi.fn(async () => null),
  findBookingsByFarmer: vi.fn(async () => []),
  insertBooking: vi.fn(async () => undefined),
  upsertManyOptions: vi.fn(async () => undefined),
};

const logisticsMock = {
  findAllOptions: vi.fn(async () => [] as unknown[]),
  findOptionById: vi.fn(async () => null),
  findBookingsByFarmer: vi.fn(async () => []),
  insertBooking: vi.fn(async () => undefined),
  upsertManyOptions: vi.fn(async () => undefined),
};

function makeLoader(): SeedLoader {
  return new SeedLoader(
    buyersMock as unknown as BuyerRepository,
    lotsMock as unknown as LotRepository,
    offersMock as unknown as OfferRepository,
    paymentsMock as unknown as PaymentRepository,
    grievancesMock as unknown as GrievanceRepository,
    storageMock as unknown as StorageRepository,
    logisticsMock as unknown as LogisticsRepository,
  );
}

function resetAllMocks(): void {
  for (const mock of [
    buyersMock, lotsMock, offersMock, paymentsMock,
    grievancesMock, storageMock, logisticsMock,
  ]) {
    for (const fn of Object.values(mock)) {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        (fn as {mockClear: () => void}).mockClear();
      }
    }
  }
}

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetAllMocks();
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  delete process.env.ENABLE_DEMO_SEEDING;
  delete process.env.VITE_ENABLE_MOCKS;
  _resetDemoSeedingDecision();
});

afterEach(() => {
  infoSpy.mockRestore();
  vi.restoreAllMocks();
  delete process.env.ENABLE_DEMO_SEEDING;
  delete process.env.VITE_ENABLE_MOCKS;
  _resetDemoSeedingDecision();
});
// ──────────────────────────────────────────────────────────────────
// A. Decision helper
// ──────────────────────────────────────────────────────────────────
describe('getDemoSeedingDecision() — server-side guard', () => {
  it('defaults to disabled when no env var is set', () => {
    expect(isDemoSeedingEnabled()).toBe(false);
    expect(getDemoSeedingDecision().source).toBe('default-off');
  });

  it('is disabled when ENABLE_DEMO_SEEDING="false"', () => {
    process.env.ENABLE_DEMO_SEEDING = 'false';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(false);
    expect(getDemoSeedingDecision().source).toBe('env:ENABLE_DEMO_SEEDING!=true');
  });

  it('is disabled when ENABLE_DEMO_SEEDING="0"', () => {
    process.env.ENABLE_DEMO_SEEDING = '0';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(false);
  });

  it('is disabled when ENABLE_DEMO_SEEDING="yes"', () => {
    process.env.ENABLE_DEMO_SEEDING = 'yes';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(false);
  });

  it('is enabled when ENABLE_DEMO_SEEDING="true"', () => {
    process.env.ENABLE_DEMO_SEEDING = 'true';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(true);
    expect(getDemoSeedingDecision().source).toBe('env:ENABLE_DEMO_SEEDING=true');
  });

  it('is enabled when ENABLE_DEMO_SEEDING="1"', () => {
    process.env.ENABLE_DEMO_SEEDING = '1';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(true);
  });

  it('does NOT consult VITE_ENABLE_MOCKS', () => {
    process.env.VITE_ENABLE_MOCKS = 'true';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(false);
  });

  it('is still disabled when BOTH VITE_ENABLE_MOCKS=true and ENABLE_DEMO_SEEDING=false', () => {
    process.env.VITE_ENABLE_MOCKS = 'true';
    process.env.ENABLE_DEMO_SEEDING = 'false';
    _resetDemoSeedingDecision();
    expect(isDemoSeedingEnabled()).toBe(false);
  });
});
// ──────────────────────────────────────────────────────────────────
// B. SeedLoader integration with the guard
// ──────────────────────────────────────────────────────────────────
describe('SeedLoader.ensureSeeded() — production safety', () => {
  it('A. default (no env var) does not write to ANY collection', async () => {
    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.upsertMany).not.toHaveBeenCalled();
    expect(storageMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(logisticsMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(lotsMock.upsert).not.toHaveBeenCalled();
    expect(offersMock.upsert).not.toHaveBeenCalled();
    expect(paymentsMock.upsert).not.toHaveBeenCalled();
    expect(grievancesMock.upsert).not.toHaveBeenCalled();

    expect(infoSpy).toHaveBeenCalled();
    const messages = infoSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('demo seeding SKIPPED'))).toBe(true);
  });

  it('B. ENABLE_DEMO_SEEDING="false" does not write', async () => {
    process.env.ENABLE_DEMO_SEEDING = 'false';
    _resetDemoSeedingDecision();

    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.upsertMany).not.toHaveBeenCalled();
    expect(storageMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(logisticsMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(lotsMock.upsert).not.toHaveBeenCalled();
    expect(offersMock.upsert).not.toHaveBeenCalled();
    expect(paymentsMock.upsert).not.toHaveBeenCalled();
    expect(grievancesMock.upsert).not.toHaveBeenCalled();
  });
  it('C. ENABLE_DEMO_SEEDING="true" seeds all 7 collections', async () => {
    process.env.ENABLE_DEMO_SEEDING = 'true';
    _resetDemoSeedingDecision();
    buyersMock.count.mockResolvedValueOnce(0);

    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.upsertMany).toHaveBeenCalledTimes(1);
    expect(
      ((buyersMock.upsertMany.mock as unknown as {calls: unknown[][]}).calls[0]?.[0] as unknown[])?.length,
    ).toBe(DEMO_BUYERS.length);

    expect(storageMock.upsertManyOptions).toHaveBeenCalledTimes(1);
    expect(
      ((storageMock.upsertManyOptions.mock as unknown as {calls: unknown[][]}).calls[0]?.[0] as unknown[])?.length,
    ).toBe(DEMO_STORAGE_OPTIONS.length);

    expect(logisticsMock.upsertManyOptions).toHaveBeenCalledTimes(1);
    expect(
      ((logisticsMock.upsertManyOptions.mock as unknown as {calls: unknown[][]}).calls[0]?.[0] as unknown[])?.length,
    ).toBe(DEMO_LOGISTICS_OPTIONS.length);

    expect(lotsMock.upsert).toHaveBeenCalledTimes(DEMO_LOTS.length);
    expect(offersMock.upsert).toHaveBeenCalledTimes(DEMO_OFFERS.length);
    expect(paymentsMock.upsert).toHaveBeenCalledTimes(DEMO_PAYMENTS.length);
    expect(grievancesMock.upsert).toHaveBeenCalledTimes(DEMO_GRIEVANCES.length);
  });

  it('D. VITE_ENABLE_MOCKS=true alone does NOT enable backend seeding', async () => {
    process.env.VITE_ENABLE_MOCKS = 'true';
    _resetDemoSeedingDecision();

    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.upsertMany).not.toHaveBeenCalled();
    expect(storageMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(logisticsMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(lotsMock.upsert).not.toHaveBeenCalled();
    expect(offersMock.upsert).not.toHaveBeenCalled();
    expect(paymentsMock.upsert).not.toHaveBeenCalled();
    expect(grievancesMock.upsert).not.toHaveBeenCalled();
  });

  it('E. guard short-circuits idempotently (no log spam on repeat)', async () => {
    const loader = makeLoader();
    await loader.ensureSeeded();
    await loader.ensureSeeded();
    await loader.ensureSeeded();

    const skipLogs = infoSpy.mock.calls.filter((c) =>
      String(c[0]).includes('demo seeding SKIPPED'),
    );
    expect(skipLogs).toHaveLength(1);
  });

  it('F. all 7 collections are gated — partial seeding is impossible', async () => {
    process.env.ENABLE_DEMO_SEEDING = 'false';
    _resetDemoSeedingDecision();

    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.upsertMany).not.toHaveBeenCalled();
    expect(storageMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(logisticsMock.upsertManyOptions).not.toHaveBeenCalled();
    expect(lotsMock.upsert).not.toHaveBeenCalled();
    expect(offersMock.upsert).not.toHaveBeenCalled();
    expect(paymentsMock.upsert).not.toHaveBeenCalled();
    expect(grievancesMock.upsert).not.toHaveBeenCalled();
  });

  it('does NOT hit Mongo for "is collection empty?" checks when disabled', async () => {
    const loader = makeLoader();
    await loader.ensureSeeded();

    expect(buyersMock.count).not.toHaveBeenCalled();
    expect(storageMock.findAllOptions).not.toHaveBeenCalled();
    expect(logisticsMock.findAllOptions).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// C. Demo payload honesty — every seeded record must self-label
// (isDemo=true) and never default to "verified" KYC.
// ──────────────────────────────────────────────────────────────────
describe('demo seed payload — self-labelling and KYC honesty', () => {
  it('every demo record carries isDemo=true so the frontend can badge it', () => {
    for (const b of DEMO_BUYERS) expect(b.isDemo).toBe(true);
    for (const l of DEMO_LOTS) expect(l.isDemo).toBe(true);
    for (const o of DEMO_OFFERS) expect(o.isDemo).toBe(true);
    for (const p of DEMO_PAYMENTS) expect(p.isDemo).toBe(true);
    for (const g of DEMO_GRIEVANCES) expect(g.isDemo).toBe(true);
    for (const s of DEMO_STORAGE_OPTIONS) expect(s.isDemo).toBe(true);
    for (const l of DEMO_LOGISTICS_OPTIONS) expect(l.isDemo).toBe(true);
  });

  it('no demo buyer defaults to verificationStatus="verified"', () => {
    const verifiedDemo = DEMO_BUYERS.filter(
      (b) => b.verificationStatus === 'verified',
    );
    expect(verifiedDemo).toEqual([]);
  });
});