/**
 * SeedLoader — idempotently inserts the demo dataset into the
 * transaction collections on first access.
 *
 * Strategy:
 *   1. Each repository method is an upsert keyed by the deterministic
 *      string IDs (`b1`, `lot-1`, ...). Re-runs do not duplicate.
 *   2. We only seed collections that are EMPTY on first run. Once a
 *      user has interacted (e.g. created their own lot) we never
 *      re-write the demo dataset — that would clobber live data.
 *   3. The seed is triggered from each controller's first read OR
 *      eagerly at boot (see TransactionModule index).
 *
 * PRODUCTION GUARD
 * ────────────────
 * Demo data is fictional and exists only to support local development
 * and offline demos. It MUST NEVER be silently written into a
 * production MongoDB. The decision is taken ONCE per process via
 * `isDemoSeedingEnabled()` (see `backend/src/config/demoSeeding.ts`):
 *
 *   • Default (no env var)         → SKIP seeding entirely.
 *   • ENABLE_DEMO_SEEDING=true     → seed (dev/staging opt-in).
 *   • VITE_ENABLE_MOCKS=...        → IGNORED (browser flag, not a
 *                                    backend authorisation).
 *
 * When seeding is disabled, every Farmer Dashboard collection
 * (buyers, logistics options, storage options, payment journal,
 * demo lots, demo offers, demo grievances) starts empty and the API
 * surfaces the honest "no data" state via `isDemo: false`.
 */

import {inject, injectable} from 'inversify';
import {isDemoSeedingEnabled, getDemoSeedingDecision} from '../../../config/demoSeeding.js';
import {BuyerRepository} from '../repositories/BuyerRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {OfferRepository} from '../repositories/OfferRepository.js';
import {PaymentRepository} from '../repositories/PaymentRepository.js';
import {GrievanceRepository} from '../repositories/GrievanceRepository.js';
import {StorageRepository} from '../repositories/StorageRepository.js';
import {LogisticsRepository} from '../repositories/LogisticsRepository.js';
import {
  DEMO_BUYERS,
  DEMO_LOTS,
  DEMO_OFFERS,
  DEMO_PAYMENTS,
  DEMO_GRIEVANCES,
  DEMO_STORAGE_OPTIONS,
  DEMO_LOGISTICS_OPTIONS,
} from '../seed/demoData.js';

@injectable()
export class SeedLoader {
  private seeded = false;
  private seedPromise: Promise<void> | null = null;

  constructor(
    @inject(BuyerRepository) private readonly buyers: BuyerRepository,
    @inject(LotRepository) private readonly lots: LotRepository,
    @inject(OfferRepository) private readonly offers: OfferRepository,
    @inject(PaymentRepository) private readonly payments: PaymentRepository,
    @inject(GrievanceRepository) private readonly grievances: GrievanceRepository,
    @inject(StorageRepository) private readonly storage: StorageRepository,
    @inject(LogisticsRepository) private readonly logistics: LogisticsRepository,
  ) {}

  /**
   * Idempotent: only inserts when the corresponding collection is
   * empty. Uses the repository's deterministic upsert paths so a
   * concurrent first call never duplicates rows.
   *
   * Production-safe: bails out early when `isDemoSeedingEnabled()`
   * is `false`, so no fictional records can ever be inserted into a
   * production MongoDB. The decision is taken once per process from
   * the backend's `ENABLE_DEMO_SEEDING` env var — the browser-supplied
   * `VITE_ENABLE_MOCKS` flag is intentionally NOT consulted.
   */
  public async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if (this.seedPromise) return this.seedPromise;

    // ── PRODUCTION GUARD ────────────────────────────────────────────
    // Demo data is fictional. Skip silently (with a one-shot
    // diagnostic log) when the backend is not explicitly opted in.
    if (!isDemoSeedingEnabled()) {
      const decision = getDemoSeedingDecision();
      console.info(
        `[transaction] demo seeding SKIPPED (${decision.source}). ` +
          'Farmer Dashboard collections will start empty. ' +
          'No fictional buyers, logistics, storage, payments, lots, offers or ' +
          'grievances will be written.',
      );
      this.seeded = true;
      return;
    }

    this.seedPromise = this.doSeed()
      .then(() => {
        this.seeded = true;
      })
      .catch((err) => {
        // Clear the promise so the next call can retry; we do not
        // want a transient Mongo blip to permanently disable seeding.
        this.seedPromise = null;
        console.error('[transaction] demo seed failed', err);
      });
    return this.seedPromise;
  }

  private async doSeed(): Promise<void> {
    const buyerCount = await this.buyers.count();
    if (buyerCount === 0) {
      await this.buyers.upsertMany(DEMO_BUYERS);
    }

    const storageColEmpty = (await this.storage.findAllOptions()).length === 0;
    if (storageColEmpty) {
      await this.storage.upsertManyOptions(DEMO_STORAGE_OPTIONS);
    }

    const logisticsColEmpty = (await this.logistics.findAllOptions()).length === 0;
    if (logisticsColEmpty) {
      await this.logistics.upsertManyOptions(DEMO_LOGISTICS_OPTIONS);
    }

    // Lots, offers, payments, grievances are farmer-scoped: seed only
    // when the lot collection is empty so we never clobber user-created
    // records on subsequent boot ups.
    const lotColEmpty = (await this.lots.findMany({}, 1)).length === 0;
    if (lotColEmpty) {
      for (const lot of DEMO_LOTS) {
        await this.lots.upsert(lot);
      }
      for (const offer of DEMO_OFFERS) {
        await this.offers.upsert(offer);
      }
      for (const payment of DEMO_PAYMENTS) {
        await this.payments.upsert(payment);
      }
      for (const g of DEMO_GRIEVANCES) {
        await this.grievances.upsert(g);
      }
    }
  }
}
