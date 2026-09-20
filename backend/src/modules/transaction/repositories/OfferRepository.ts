/**
 * OfferRepository — reads/writes the `offers` collection.
 *
 * Index strategy:
 *   1. Unique on `id` for deterministic upserts.
 *   2. Compound (lotId, status) for the per-lot offers feed.
 *   3. Compound (buyerId, status) for buyer-side analytics.
 *   4. Compound (lotId, createdAt) for "newest offers for this lot".
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {OfferRecord, OfferStatus} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class OfferRepository {
  private collection: Collection<OfferRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<OfferRecord>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<OfferRecord>('offers');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({id: 1}, {unique: true});
      await col.createIndex({lotId: 1, status: 1});
      await col.createIndex({buyerId: 1, status: 1});
      await col.createIndex({lotId: 1, createdAt: -1});
    } catch (err) {
      console.error('[transaction] failed to build offers indexes', err);
    }
  }

  public async upsert(record: OfferRecord): Promise<void> {
    const col = await this.init();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async insert(record: OfferRecord): Promise<void> {
    const col = await this.init();
    await col.insertOne(record);
  }

  public async findMany(
    filter: Filter<OfferRecord> = {},
    limit = 500,
  ): Promise<OfferRecord[]> {
    const col = await this.init();
    return col
      .find(filter, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }

  public async findById(id: string): Promise<OfferRecord | null> {
    const col = await this.init();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  public async findByLot(lotId: string): Promise<OfferRecord[]> {
    const col = await this.init();
    return col
      .find({lotId}, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .toArray();
  }

  /**
   * Atomic state transition. Returns the updated offer, or null when
   * the offer does not exist OR the current status is not in
   * `allowedFrom`.
   *
   * This is the enforcement point for the
   *   accepted -> not pending
   * invariant: an accepted/rejected/withdrawn/expired offer cannot
   * become pending again.
   */
  public async transition(
    id: string,
    allowedFrom: OfferStatus[],
    next: OfferStatus,
  ): Promise<OfferRecord | null> {
    const col = await this.init();
    const updated = await col.findOneAndUpdate(
      {id, status: {$in: allowedFrom}},
      {$set: {status: next, updatedAt: new Date().toISOString()}},
      {returnDocument: 'after', projection: NO_ID_PROJECTION},
    );
    return (updated as unknown) as OfferRecord | null;
  }

  /**
   * Atomically reject every sibling offer for the same lot, except
   * the supplied offerId. Used by OfferService.acceptOffer when the
   * farmer accepts one offer so all competing offers get auto-rejected.
   *
   * Returns the count of offers that were transitioned.
   */
  public async rejectSiblings(
    lotId: string,
    exceptOfferId: string,
  ): Promise<number> {
    const col = await this.init();
    const result = await col.updateMany(
      {
        lotId,
        id: {$ne: exceptOfferId},
        status: {$in: ['pending', 'countered']},
      },
      {$set: {status: 'rejected', updatedAt: new Date().toISOString()}},
    );
    return result.modifiedCount;
  }

  /**
   * Atomically reject EVERY pending/countered offer for the lot. Used by
   * LotController.delete when a lot is removed.
   */
  public async rejectAllForLot(lotId: string): Promise<number> {
    const col = await this.init();
    const result = await col.updateMany(
      {
        lotId,
        status: {$in: ['pending', 'countered', 'accepted']},
      },
      {$set: {status: 'rejected', updatedAt: new Date().toISOString()}},
    );
    return result.modifiedCount;
  }
}
