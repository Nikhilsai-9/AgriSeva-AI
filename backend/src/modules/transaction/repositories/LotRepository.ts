/**
 * LotRepository — reads/writes the `lots` collection.
 *
 * Index strategy:
 *   1. Unique on `id` for deterministic upserts.
 *   2. Compound (farmerId, status) for "my active lots" / "my sold lots"
 *      style queries that the dashboard needs.
 *   3. Compound (state, commodity) for cross-farmer analytics.
 *   4. Compound (status, crop) for the matching service.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {LotRecord, LotStatus} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class LotRepository {
  private collection: Collection<LotRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<LotRecord>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<LotRecord>('lots');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({id: 1}, {unique: true});
      await col.createIndex({farmerId: 1, status: 1});
      await col.createIndex({farmerId: 1, createdAt: -1});
      await col.createIndex({state: 1, crop: 1});
      await col.createIndex({status: 1, crop: 1});
    } catch (err) {
      console.error('[transaction] failed to build lots indexes', err);
    }
  }

  public async upsert(record: LotRecord): Promise<void> {
    const col = await this.init();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async insert(record: LotRecord): Promise<void> {
    const col = await this.init();
    await col.insertOne(record);
  }

  public async update(
    id: string,
    patch: Partial<LotRecord>,
  ): Promise<LotRecord | null> {
    const col = await this.init();
    const update = {...patch, updatedAt: new Date().toISOString()};
    const updated = await col.findOneAndUpdate(
      {id},
      {$set: update},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as LotRecord | null;
  }

  /**
   * Update with ownership enforcement. Used by OfferService when it
   * transitions the lot to `sold` after an offer is accepted.
   */
  public async updateForFarmer(
    id: string,
    farmerId: string,
    patch: Partial<LotRecord>,
  ): Promise<LotRecord | null> {
    const col = await this.init();
    const update = {...patch, updatedAt: new Date().toISOString()};
    const updated = await col.findOneAndUpdate(
      {id, farmerId},
      {$set: update},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as LotRecord | null;
  }

  public async updateStatus(
    id: string,
    status: LotStatus,
    farmerId?: string,
  ): Promise<LotRecord | null> {
    const col = await this.init();
    const filter = farmerId ? {id, farmerId} : {id};
    const updated = await col.findOneAndUpdate(
      filter,
      {$set: {status, updatedAt: new Date().toISOString()}},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as LotRecord | null;
  }

  public async findMany(
    filter: Filter<LotRecord> = {},
    limit = 200,
  ): Promise<LotRecord[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }

  public async findById(id: string): Promise<LotRecord | null> {
    const col = await this.init();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  public async findByIdForFarmer(
    id: string,
    farmerId: string,
  ): Promise<LotRecord | null> {
    const col = await this.init();
    return col.findOne(
      {id, farmerId},
      {projection: NO_ID_PROJECTION},
    );
  }

  public async delete(id: string, farmerId?: string): Promise<boolean> {
    const col = await this.init();
    const filter = farmerId ? {id, farmerId} : {id};
    const result = await col.deleteOne(filter);
    return result.deletedCount > 0;
  }
}
