/**
 * GrievanceRepository — reads/writes the `grievances` collection.
 *
 * Index strategy:
 *   1. Unique on `id`.
 *   2. Compound (farmerId, status) for the farmer's grievance list.
 *   3. Compound (status, createdAt) for the moderator queue.
 *   4. Compound (transactionRef) for cross-referencing.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {GrievanceRecord, GrievanceStatus} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class GrievanceRepository {
  private collection: Collection<GrievanceRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<GrievanceRecord>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<GrievanceRecord>(
      'grievances',
    );
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({id: 1}, {unique: true});
      await col.createIndex({farmerId: 1, status: 1});
      await col.createIndex({status: 1, createdAt: -1});
      await col.createIndex({transactionRef: 1});
    } catch (err) {
      console.error('[transaction] failed to build grievances indexes', err);
    }
  }

  public async upsert(record: GrievanceRecord): Promise<void> {
    const col = await this.init();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async insert(record: GrievanceRecord): Promise<void> {
    const col = await this.init();
    await col.insertOne(record);
  }

  public async findMany(
    filter: Filter<GrievanceRecord> = {},
    limit = 500,
  ): Promise<GrievanceRecord[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }

  public async findById(id: string): Promise<GrievanceRecord | null> {
    const col = await this.init();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  public async update(
    id: string,
    patch: Partial<GrievanceRecord>,
  ): Promise<GrievanceRecord | null> {
    const col = await this.init();
    const updated = await col.findOneAndUpdate(
      {id},
      {$set: {...patch, updatedAt: new Date().toISOString()}},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as GrievanceRecord | null;
  }

  public async transition(
    id: string,
    next: GrievanceStatus,
  ): Promise<GrievanceRecord | null> {
    const col = await this.init();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      status: next,
      updatedAt: now,
    };
    if (next === 'resolved') {
      set.resolvedAt = now;
    }
    const updated = await col.findOneAndUpdate(
      {id},
      {$set: set},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as GrievanceRecord | null;
  }
}
