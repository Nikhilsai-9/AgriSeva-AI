/**
 * MandiRepository — stores mandi metadata we discover from upstream.
 *
 * Coordinates are populated ONLY when the upstream source actually
 * provides them. We never fabricate lat/lon from city names. When
 * coordinates are absent, `distanceKm` calculations in the dashboard
 * gracefully degrade to null.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';

export interface IMandi {
  /** Canonical mandi key: lowercase "{state}|{market}". */
  mandiKey: string;
  state: string;
  market: string;
  district?: string;
  source?: 'agmarknet' | 'enam' | 'demo';
  /** Only populated when upstream supplies real coordinates. */
  lat?: number;
  lon?: number;
  updatedAt: string;
}

@injectable()
export class MandiRepository {
  private collection: Collection<IMandi> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<IMandi>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<IMandi>('mandis');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({mandiKey: 1}, {unique: true});
      await col.createIndex({state: 1, district: 1, market: 1});
    } catch (err) {
      console.error('[marketIntelligence] failed to build mandis indexes', err);
    }
  }

  public async upsertMany(mandis: Partial<IMandi>[]): Promise<void> {
    if (!mandis.length) return;
    const col = await this.init();
    for (const m of mandis) {
      if (!m.mandiKey) continue;
      const {mandiKey, ...rest} = m;
      await col.updateOne(
        {mandiKey},
        {$set: {mandiKey, ...rest, updatedAt: new Date().toISOString()}},
        {upsert: true},
      );
    }
  }

  public async findByKey(key: string): Promise<IMandi | null> {
    const col = await this.init();
    return col.findOne({mandiKey: key});
  }

  public async find(filter: Filter<IMandi>, limit = 100): Promise<IMandi[]> {
    const col = await this.init();
    return col.find(filter).limit(limit).toArray();
  }
}
