/**
 * LogisticsRepository — reads/writes the `logistics_options` and
 * `logistics_bookings` collections.
 *
 * Index strategy for logistics_options:
 *   1. Unique on `id`.
 *   2. Compound (vehicleType) for type filters.
 *
 * Index strategy for logistics_bookings:
 *   1. Unique on `id`.
 *   2. Compound (farmerId, createdAt) for newest-first listing.
 *   3. Compound (lotId) for per-lot logistics audit.
 *
 * These records are explicitly prototype/demo data. The repository
 * keeps `isDemo: true` on every option to make sure downstream
 * consumers can render a "Demo Data" badge if they choose.
 */

import {inject, injectable} from 'inversify';
import {Collection} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {
  LogisticsOptionRecord,
  LogisticsBookingRecord,
} from '../types.js';

const NO_ID_PROJECTION = {_id: 0} as const;

@injectable()
export class LogisticsRepository {
  private optionsCollection: Collection<LogisticsOptionRecord> | null = null;
  private bookingsCollection: Collection<LogisticsBookingRecord> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  // ─── options ──────────────────────────────────────────────────────────

  private async initOptions(): Promise<Collection<LogisticsOptionRecord>> {
    if (this.optionsCollection) return this.optionsCollection;
    this.optionsCollection = await this.db.getCollection<LogisticsOptionRecord>(
      'logistics_options',
    );
    try {
      await this.optionsCollection.createIndex({id: 1}, {unique: true});
      await this.optionsCollection.createIndex({vehicleType: 1});
    } catch (err) {
      console.error(
        '[transaction] failed to build logistics_options indexes',
        err,
      );
    }
    return this.optionsCollection;
  }

  public async upsertOption(record: LogisticsOptionRecord): Promise<void> {
    const col = await this.initOptions();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async upsertManyOptions(records: LogisticsOptionRecord[]): Promise<void> {
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

  public async findAllOptions(): Promise<LogisticsOptionRecord[]> {
    const col = await this.initOptions();
    return col
      .find({}, {projection: NO_ID_PROJECTION})
      .sort({distanceKm: 1})
      .toArray();
  }

  public async findOptionById(
    id: string,
  ): Promise<LogisticsOptionRecord | null> {
    const col = await this.initOptions();
    return col.findOne({id}, {projection: NO_ID_PROJECTION});
  }

  // ─── bookings ─────────────────────────────────────────────────────────

  private async initBookings(): Promise<Collection<LogisticsBookingRecord>> {
    if (this.bookingsCollection) return this.bookingsCollection;
    this.bookingsCollection = await this.db.getCollection<LogisticsBookingRecord>(
      'logistics_bookings',
    );
    try {
      await this.bookingsCollection.createIndex({id: 1}, {unique: true});
      await this.bookingsCollection.createIndex({farmerId: 1, createdAt: -1});
      await this.bookingsCollection.createIndex({lotId: 1});
    } catch (err) {
      console.error(
        '[transaction] failed to build logistics_bookings indexes',
        err,
      );
    }
    return this.bookingsCollection;
  }

  public async insertBooking(record: LogisticsBookingRecord): Promise<void> {
    const col = await this.initBookings();
    await col.insertOne(record);
  }

  public async upsertBooking(record: LogisticsBookingRecord): Promise<void> {
    const col = await this.initBookings();
    await col.updateOne(
      {id: record.id},
      {$set: record},
      {upsert: true},
    );
  }

  public async findBookingsByFarmer(
    farmerId: string,
  ): Promise<LogisticsBookingRecord[]> {
    const col = await this.initBookings();
    return col
      .find({farmerId}, {projection: NO_ID_PROJECTION})
      .sort({createdAt: -1})
      .toArray();
  }
}
