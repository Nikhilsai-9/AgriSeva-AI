/**
 * PaymentRepository — reads/writes the `payments` collection.
 *
 * Index strategy:
 *   1. Unique on `id`.
 *   2. Compound (farmerId, status) for the farmer's payments list.
 *   3. Compound (lotId) for "all payments for this lot".
 *   4. Compound (farmerId, createdAt) for newest-first listing.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {PaymentRecordDoc, PaymentStatus} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class PaymentRepository {
  private collection: Collection<PaymentRecordDoc> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<PaymentRecordDoc>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<PaymentRecordDoc>('payments');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({id: 1}, {unique: true});
      await col.createIndex({farmerId: 1, status: 1});
      await col.createIndex({lotId: 1});
      await col.createIndex({farmerId: 1, createdAt: -1});
    } catch (err) {
      console.error('[transaction] failed to build payments indexes', err);
    }
  }

  public async upsert(record: PaymentRecordDoc): Promise<void> {
    const col = await this.init();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async insert(record: PaymentRecordDoc): Promise<void> {
    const col = await this.init();
    await col.insertOne(record);
  }

  public async findMany(
    filter: Filter<PaymentRecordDoc> = {},
    limit = 500,
  ): Promise<PaymentRecordDoc[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }

  public async findById(id: string): Promise<PaymentRecordDoc | null> {
    const col = await this.init();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  public async findByLot(lotId: string): Promise<PaymentRecordDoc[]> {
    const col = await this.init();
    return col
      .find({lotId}, {projection: NO_ID_PROJECTION})
      .toArray();
  }

  /**
   * Used by the offer-accepted cascade to ensure we never create two
   * payment records for the same lot.
   */
  public async findActiveByLot(lotId: string): Promise<PaymentRecordDoc | null> {
    const col = await this.init();
    return col.findOne(
      {
        lotId,
        status: {$in: ['pending', 'initiated', 'partial', 'completed', 'paid']},
      },
      {projection: NO_ID_PROJECTION},
    );
  }

  public async updateStatus(
    id: string,
    status: PaymentStatus,
    completedAt: string | null,
  ): Promise<PaymentRecordDoc | null> {
    const col = await this.init();
    const updated = await col.findOneAndUpdate(
      {id},
      {
        $set: {
          status,
          completedAt,
          updatedAt: new Date().toISOString(),
        },
      },
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as PaymentRecordDoc | null;
  }

  public async update(
    id: string,
    patch: Partial<PaymentRecordDoc>,
  ): Promise<PaymentRecordDoc | null> {
    const col = await this.init();
    const updated = await col.findOneAndUpdate(
      {id},
      {$set: {...patch, updatedAt: new Date().toISOString()}},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as PaymentRecordDoc | null;
  }
}
