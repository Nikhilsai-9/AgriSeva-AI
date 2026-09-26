/**
 * DataUpdateLogRepository — append-only audit of every upstream fetch
 * the ingestion layer performs (success or failure).
 *
 * Used by MarketReliabilityService to compute per-source freshness
 * and consecutive-failure counters, and surfaced via
 * GET /api/market-health.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';
import type {MarketSourceId} from '../types.js';

/**
 * PHASE 2 §P2.D — Coarse classification of an ingestion
 * failure. Drives `MarketReliabilityService` captcha counting
 * and `MarketHealthController` surface reporting.
 */
export type DataUpdateErrorCategory =
  | 'captcha'
  | 'parse'
  | 'network'
  | 'rate_limit'
  | 'other';

export interface IDataUpdateLog {
  source: MarketSourceId;
  tool: string;
  success: boolean;
  durationMs: number;
  fetchedAt: string;
  recordsNormalised?: number;
  recordsPersisted?: number;
  error?: string;
  target?: Record<string, unknown>;
  /** PHASE 2 §P2.D — Failure category. Set on `success: false` rows. */
  errorCategory?: DataUpdateErrorCategory;
}

@injectable()
export class DataUpdateLogRepository {
  private collection: Collection<IDataUpdateLog> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<IDataUpdateLog>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<IDataUpdateLog>('data_update_logs');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({source: 1, fetchedAt: -1});
      await col.createIndex({success: 1, fetchedAt: -1});
    } catch (err) {
      console.error('[marketIntelligence] failed to build data_update_logs indexes', err);
    }
  }

  public async append(entry: IDataUpdateLog): Promise<void> {
    try {
      const col = await this.init();
      await col.insertOne(entry);
    } catch (err: any) {
      console.error('[marketIntelligence] failed to write data_update_log', err?.message);
    }
  }

  public async findRecent(filter: Filter<IDataUpdateLog>, limit = 50): Promise<IDataUpdateLog[]> {
    const col = await this.init();
    return col.find(filter).sort({fetchedAt: -1}).limit(limit).toArray();
  }
}
