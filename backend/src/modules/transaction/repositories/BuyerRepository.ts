/**
 * BuyerRepository — reads/writes the `buyers` collection.
 *
 * Index strategy:
 *   1. Unique on `id` for deterministic upserts (see seed loader).
 *   2. Compound (verificationStatus, businessType) for the buyer
 *      directory surface filtering.
 *   3. Compound (state, district) for location-based filtering.
 *
 * Read-path contract: repository strips Mongo's `_id` so controllers
 * never have to remember to do it.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {BuyerRecord, VerificationStatus} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class BuyerRepository {
  private collection: Collection<BuyerRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<BuyerRecord>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<BuyerRecord>('buyers');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({id: 1}, {unique: true});
      await col.createIndex({verificationStatus: 1, businessType: 1});
      await col.createIndex({state: 1, district: 1});
    } catch (err) {
      console.error('[transaction] failed to build buyers indexes', err);
    }
  }

  public async upsert(record: BuyerRecord): Promise<void> {
    const col = await this.init();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async upsertMany(records: BuyerRecord[]): Promise<void> {
    if (!records.length) return;
    const col = await this.init();
    const ops = records.map((r) => ({
      updateOne: {
        filter: {id: r.id},
        update: {$set: r},
        upsert: true,
      },
    }));
    await col.bulkWrite(ops);
  }

  public async findMany(
    filter: Filter<BuyerRecord> = {},
    limit = 200,
  ): Promise<BuyerRecord[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .limit(limit)
      .toArray();
  }

  public async findById(id: string): Promise<BuyerRecord | null> {
    const col = await this.init();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  public async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
  ): Promise<BuyerRecord | null> {
    const col = await this.init();
    const updated = await col.findOneAndUpdate(
      {id},
      {$set: {verificationStatus: status, updatedAt: new Date().toISOString()}},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    // mongodb driver v6 returns the doc directly (no .value wrapper)
    return (updated as unknown) as BuyerRecord | null;
  }

  public async count(): Promise<number> {
    const col = await this.init();
    return col.countDocuments({});
  }
}
