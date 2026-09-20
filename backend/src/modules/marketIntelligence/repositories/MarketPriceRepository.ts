/**
 * MarketPriceRepository — reads/writes the `market_prices` collection.
 *
 * Index strategy (built once on init):
 *   1. Unique on `recordKey` for idempotent upserts.
 *   2. Compound (state, commodity, arrivalDate) for the primary
 *      "today's prices for my state" query.
 *   3. Compound (source, state, commodity, arrivalDate) for per-source
 *      reliability counts and source-aware filtering.
 *   4. Compound (commodity, arrivalDate) for cross-state comparisons.
 *
 * IMPORTANT: NO TTL on `arrivalDate`. Historical records must be
 * retained for chart rendering and trend analysis. A separate
 * `data_update_logs.expiresAt` field controls log retention if needed.
 *
 * Read-path contract: ALL read methods project out MongoDB's
 * internal `_id` so the API surface never leaks the database
 * primary key. The canonical `MarketPriceRecord` type does not
 * declare `_id`; the projection enforces that contract at the
 * data boundary rather than relying on every controller to
 * remember to strip it.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {MarketPriceRecord} from '../types.js';

/**
 * Mongo projection that hides the internal `_id` field. We never
 * pass `_id` back to callers — controllers expose `recordKey` as
 * the stable public identifier.
 */
const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class MarketPriceRepository {
  private collection: Collection<MarketPriceRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<MarketPriceRecord>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<MarketPriceRecord>(
      'market_prices',
    );
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({recordKey: 1}, {unique: true});
      await col.createIndex({state: 1, commodity: 1, arrivalDate: -1});
      await col.createIndex({source: 1, state: 1, commodity: 1, arrivalDate: -1});
      await col.createIndex({commodity: 1, arrivalDate: -1});
      await col.createIndex({state: 1, market: 1, commodity: 1, arrivalDate: -1});
    } catch (err) {
      console.error('[marketIntelligence] failed to build market_prices indexes', err);
    }
  }

  // ─── Writes ──────────────────────────────────────────────────────────

  /**
   * Idempotent upsert by `recordKey`. Returns true if a new row was
   * created, false if the existing row was updated.
   */
  public async upsert(record: MarketPriceRecord): Promise<boolean> {
    const col = await this.init();
    const {recordKey, ...rest} = record;
    const result = await col.updateOne(
      {recordKey},
      {
        $set: rest,
        $setOnInsert: {recordKey},
      },
      {upsert: true},
    );
    return result.upsertedCount > 0;
  }

  public async upsertMany(records: MarketPriceRecord[]): Promise<{
    inserted: number;
    updated: number;
    errors: string[];
  }> {
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];
    for (const r of records) {
      try {
        const created = await this.upsert(r);
        if (created) inserted += 1;
        else updated += 1;
      } catch (err: any) {
        errors.push(err?.message ?? String(err));
      }
    }
    return {inserted, updated, errors};
  }

  // ─── Reads ───────────────────────────────────────────────────────────

  public async findMany(filter: Filter<MarketPriceRecord>, limit: number): Promise<MarketPriceRecord[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({arrivalDate: -1})
      .limit(limit)
      .toArray();
  }

  public async findByRecordKey(key: string): Promise<MarketPriceRecord | null> {
    const col = await this.init();
    return col.findOne({recordKey: key}, {projection: NO_ID_PROJECTION});
  }

  /**
   * Returns the most recent N records for a given
   * (state, market, commodity, variety) tuple, oldest first.
   * Used by MarketHistoryService.
   */
  public async findHistory(args: {
    state: string;
    market: string;
    commodity: string;
    variety?: string;
    lookbackDays?: number;
  }): Promise<MarketPriceRecord[]> {
    const col = await this.init();
    const filter: Filter<MarketPriceRecord> = {
      state: args.state,
      market: args.market,
      commodity: args.commodity,
    };
    if (args.variety) {
      filter.variety = args.variety;
    } else {
      (filter as any).variety = {$in: [null, '']};
    }
    if (args.lookbackDays && args.lookbackDays > 0) {
      const since = new Date(Date.now() - args.lookbackDays * 86400_000)
        .toISOString()
        .slice(0, 10);
      filter.arrivalDate = {$gte: since};
    }
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({arrivalDate: 1})
      .toArray();
  }

  public async countBySource(): Promise<Record<string, number>> {
    const col = await this.init();
    const pipeline = [
      {$group: {_id: '$source', count: {$sum: 1}}},
    ];
    const out: Record<string, number> = {};
    for await (const row of col.aggregate(pipeline)) {
      out[(row as any)._id] = (row as any).count;
    }
    return out;
  }
}
