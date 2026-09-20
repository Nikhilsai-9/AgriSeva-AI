/**
 * MarketHistoryService — computes price change (%) and trend (%)
 * against previous comparable observations.
 *
 * Rules:
 *   - Two records are "comparable" iff state, market, commodity, and
 *     variety match (variety=null on both sides is treated as a match).
 *   - `changePct` = ((current.modal - previous.modal) / previous.modal) * 100
 *     when previous.modal > 0. Otherwise null (NEVER fabricated).
 *   - `trendPct` is the mean of last 7 days of comparable changePct
 *     values, also null when fewer than 2 prior observations exist.
 *   - changePct / trendPct are computed on read from persisted records;
 *     we do not mutate the stored record.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import type {MarketHistoryPoint, MarketPriceRecord} from '../types.js';

@injectable()
export class MarketHistoryService {
  constructor(
    @inject(GLOBAL_TYPES.MarketPriceRepository)
    private readonly priceRepo: MarketPriceRepository,
  ) {}

  /**
   * Return a time-series of price points oldest→newest, with each point
   * carrying its computed change vs the immediately previous comparable
   * observation.
   */
  public async getHistory(args: {
    state: string;
    market: string;
    commodity: string;
    variety?: string;
    lookbackDays?: number;
  }): Promise<MarketHistoryPoint[]> {
    const rows = await this.priceRepo.findHistory(args);
    return this.annotate(rows);
  }

  /**
   * Take an existing list of normalised records and return them with
   * `changePct` and `trendPct` populated in-place (mutates copies).
   */
  public annotateWithChange(records: MarketPriceRecord[]): MarketPriceRecord[] {
    if (!records.length) return records;
    const sortedAsc = [...records].sort((a, b) =>
      a.arrivalDate.localeCompare(b.arrivalDate),
    );
    const changeByKey = new Map<string, number | null>();

    let prev: MarketPriceRecord | null = null;
    for (const r of sortedAsc) {
      const comparable =
        prev &&
        prev.state.toLowerCase() === r.state.toLowerCase() &&
        prev.market.toLowerCase() === r.market.toLowerCase() &&
        prev.commodity.toLowerCase() === r.commodity.toLowerCase() &&
        (prev.variety ?? '').toLowerCase() ===
          (r.variety ?? '').toLowerCase();
      let pct: number | null = null;
      if (comparable && prev && prev.modalPrice && r.modalPrice) {
        pct =
          ((r.modalPrice - prev.modalPrice) / prev.modalPrice) * 100;
        pct = Math.round(pct * 100) / 100;
      }
      changeByKey.set(r.recordKey, pct);
      prev = r;
    }

    // Trend = 7-day rolling mean of recent changePct values
    const trendByKey = new Map<string, number | null>();
    const recentChanges: number[] = [];
    for (const r of sortedAsc.slice(-8)) {
      const c = changeByKey.get(r.recordKey);
      if (typeof c === 'number') recentChanges.push(c);
    }
    const trend =
      recentChanges.length >= 1
        ? Math.round(
            (recentChanges.reduce((a, b) => a + b, 0) /
              recentChanges.length) *
              100,
          ) / 100
        : null;
    for (const r of sortedAsc) {
      trendByKey.set(r.recordKey, trend);
    }

    return records.map(r => ({
      ...r,
      changePct: changeByKey.get(r.recordKey) ?? null,
      trendPct: trendByKey.get(r.recordKey) ?? null,
    }));
  }

  // ─── internal ────────────────────────────────────────────────────────

  private annotate(rows: MarketPriceRecord[]): MarketHistoryPoint[] {
    if (!rows.length) return [];
    const annotated = this.annotateWithChange(rows);
    return annotated.map(r => ({
      arrivalDate: r.arrivalDate,
      modalPrice: r.modalPrice,
      minPrice: r.minPrice,
      maxPrice: r.maxPrice,
      source: r.source,
    }));
  }
}
