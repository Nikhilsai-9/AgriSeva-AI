/**
 * StorageRepository — reads/writes the `storage_options` and
 * `storage_bookings` collections.
 *
 * Index strategy for storage_options:
 *   1. Unique on `id`.
 *   2. Compound (state, district) for location filters.
 *
 * Index strategy for storage_bookings:
 *   1. Unique on `id`.
 *   2. Compound (farmerId, createdAt) for newest-first listing.
 *   3. Compound (storageId) for capacity bookkeeping.
 */

import {inject, injectable} from 'inversify';
import {Collection} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {
  StorageOptionRecord,
  StorageBookingRecord,
} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class StorageRepository {
  private optionsCollection: Collection<StorageOptionRecord> | null = null;
  private bookingsCollection: Collection<StorageBookingRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  // ─── options ──────────────────────────────────────────────────────────

  private async initOptions(): Promise<Collection<StorageOptionRecord>> {
    if (this.optionsCollection) return this.optionsCollection;
    this.optionsCollection = await this.db.getCollection<StorageOptionRecord>(
      'storage_options',
    );
    try {
      await this.optionsCollection.createIndex({id: 1}, {unique: true});
      await this.optionsCollection.createIndex({state: 1, district: 1});
    } catch (err) {
      console.error(
        '[transaction] failed to build storage_options indexes',
        err,
      );
    }
    return this.optionsCollection;
  }

  public async upsertOption(record: StorageOptionRecord): Promise<void> {
    const col = await this.initOptions();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async upsertManyOptions(records: StorageOptionRecord[]): Promise<void> {
    if (!records.length) return;
    const col = await this.initOptions();
    const ops = records.map((r) => ({
      updateOne: {
        filter: {id: r.id},
        update: {$set: r},
        upsert: true,
      },
    }));
    await col.bulkWrite(ops);
  }

  public async findAllOptions(): Promise<StorageOptionRecord[]> {
    const col = await this.initOptions();
    return col
      .find({}, {projection: NO_ID_PROJECTION})
      .sort({distanceKm: 1})
      .toArray();
  }

  public async findOptionById(id: string): Promise<StorageOptionRecord | null> {
    const col = await this.initOptions();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  // ─── bookings ─────────────────────────────────────────────────────────

  private async initBookings(): Promise<Collection<StorageBookingRecord>> {
    if (this.bookingsCollection) return this.bookingsCollection;
    this.bookingsCollection = await this.db.getCollection<StorageBookingRecord>(
      'storage_bookings',
    );
    try {
      await this.bookingsCollection.createIndex({id: 1}, {unique: true});
      await this.bookingsCollection.createIndex({farmerId: 1, createdAt: -1});
      await this.bookingsCollection.createIndex({storageId: 1});
    } catch (err) {
      console.error(
        '[transaction] failed to build storage_bookings indexes',
        err,
      );
    }
    return this.bookingsCollection;
  }

  public async insertBooking(record: StorageBookingRecord): Promise<void> {
    const col = await this.initBookings();
    await col.insertOne(record);
  }

  public async upsertBooking(record: StorageBookingRecord): Promise<void> {
    const col = await this.initBookings();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async findBookingsByFarmer(
    farmerId: string,
  ): Promise<StorageBookingRecord[]> {
    const col = await this.initBookings();
    return col
      .find({farmerId}, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .toArray();
  }

  public async findBookingById(id: string): Promise<StorageBookingRecord | null> {
    const col = await this.initBookings();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }
}
