/**
 * CommodityAliasRepository — maps alternate spellings to canonical
 * commodity names so a user search for "Tamatar" finds the same
 * record as "Tomato".
 *
 * Seed entries are added lazily on first encounter from the upstream
 * MCPs; nothing is fabricated.
 */

import {inject, injectable} from 'inversify';
import {Collection, Filter} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/index.js';

export interface ICommodityAlias {
  aliasKey: string; // lowercase, trimmed
  canonical: string;
  source?: 'agmarknet' | 'enam';
  updatedAt: string;
}

@injectable()
export class CommodityAliasRepository {
  private collection: Collection<ICommodityAlias> | null = null;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init(): Promise<Collection<ICommodityAlias>> {
    if (this.collection) return this.collection;
    this.collection = await this.db.getCollection<ICommodityAlias>('commodity_alias');
    await this.ensureIndexes();
    return this.collection;
  }

  private async ensureIndexes(): Promise<void> {
    try {
      const col = await this.init();
      await col.createIndex({aliasKey: 1}, {unique: true});
    } catch (err) {
      console.error('[marketIntelligence] failed to build commodity_alias indexes', err);
    }
  }

  public async upsertAlias(alias: string, canonical: string, source?: 'agmarknet' | 'enam'): Promise<void> {
    if (!alias || !canonical) return;
    const col = await this.init();
    const key = alias.toLowerCase().trim();
    await col.updateOne(
      {aliasKey: key},
      {
        $set: {
          aliasKey: key,
          canonical: canonical.trim(),
          source,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {},
      },
      {upsert: true},
    );
  }

  public async findByAlias(alias: string): Promise<ICommodityAlias | null> {
    const col = await this.init();
    return col.findOne({aliasKey: alias.toLowerCase().trim()});
  }

  public async findMany(filter: Filter<ICommodityAlias> = {}, limit = 200): Promise<ICommodityAlias[]> {
    const col = await this.init();
    return col.find(filter).limit(limit).toArray();
  }

  /**
   * Resolve a user-supplied commodity string to one or more canonical
   * commodity names by exact-match lookup against `commodity_alias`.
   *
   * Behaviour contract (NO uncontrolled fuzzy matching):
   *   1. The input itself is always a candidate (exact match).
   *   2. If `commodity_alias` has an entry with `aliasKey = lowercase(input)`,
   *      its `canonical` field is added to the candidate set.
   *   3. Returns the de-duplicated candidate list in lowercase form.
   *
   * Rationale: the canonical commodity as stored by upstream Agmarknet
   * is often a parenthetical disambiguation such as
   * "Bajra(Pearl Millet/Cumbu)" while a farmer may query for "Bajra".
   * The alias table is seeded from real past ingestion observations
   * (see `MarketIngestionService.persistAll`), never fabricated.
   */
  public async resolveCanonical(input: string): Promise<string[]> {
    const trimmed = (input ?? '').trim();
    if (!trimmed) return [];
    const candidates = new Set<string>([trimmed]);
    const alias = await this.findByAlias(trimmed);
    if (alias?.canonical) candidates.add(alias.canonical);
    return Array.from(candidates);
  }
}
