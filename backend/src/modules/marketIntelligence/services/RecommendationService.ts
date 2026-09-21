/**
 * RecommendationService — server-side thin wrapper that runs the
 * existing frontend recommendation engine server-side.
 *
 * PHASE 1 §P2.4 — this service used to sort by `modalPrice` alone
 * (single-factor). It now uses the shared 5-factor scoring defined
 * in `./scoring.ts` and flags the recommendation as `isDegraded`
 * because the server endpoint does not receive a `FarmerLot` /
 * `Buyer[]` / `Grievance[]` (FE-only domain objects).
 *
 * The frontend engines (`recommendBestMarketForLot`,
 * `use-market-match.ts`) remain in place for per-lot decisions on
 * `FarmerHomePage`, `MarketComparisonPage`, etc. — they need
 * FE-only data that the server has no way of knowing.
 *
 * PHASE 1 §P2.4 STOP-condition: do not RETIRE the FE engine. The
 * server-side scoring is a SUPERSET for the comparison endpoint
 * only; the FE engine continues to power lot-specific
 * recommendations.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import {MarketHistoryService} from './MarketHistoryService.js';
import {
  scoreRows,
  isDegradedMode,
} from './scoring.js';
import type {MarketComparisonRow, MarketPriceRecord} from '../types.js';

/** A scored server recommendation — superset of the old shape. */
export interface ServerRecommendation {
  market: string;
  state: string;
  district?: string;
  commodity: string;
  modalPrice?: number;
  unit: string;
  arrivalDate: string;
  source: MarketPriceRecord['source'];
  sourceSystem: string;
  /** Top-4 reasons ordered by raw contribution to the score. */
  reasons: string[];
  /** 0..100 weighted score (1 decimal). */
  score: number;
  /** Sub-scores for each factor (0..100). */
  breakdown: {
    netValue: number;
    distance: number;
    demand: number;
    paymentReliability: number;
    qualityMatch: number;
  };
}

@injectable()
export class RecommendationService {
  constructor(
    @inject(GLOBAL_TYPES.MarketPriceRepository)
    private readonly priceRepo: MarketPriceRepository,
    @inject(GLOBAL_TYPES.MarketHistoryService)
    private readonly historyService: MarketHistoryService,
  ) {}

  /**
   * Build a price-based comparison row set + a server-side "best of N"
   * recommendation. Pure; no I/O beyond the price repo.
   *
   * PHASE 1 §P2.4: the recommendation now uses 5-factor scoring
   * (see `./scoring.ts`) and the response includes `isDegraded: true`
   * because no `FarmerLot`/`Buyer[]`/`Grievance[]` is supplied.
   */
  public async compare(input: {
    commodity: string;
    state?: string;
    limit?: number;
  }): Promise<{
    rows: MarketComparisonRow[];
    recommendation: ServerRecommendation | null;
    isDemo: boolean;
    isDegraded: boolean;
    fetchedAt: string;
  }> {
    const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
    const filter: any = {commodity: input.commodity};
    if (input.state) filter.state = input.state;

    const all = await this.priceRepo.findMany(filter, 200);
    const annotated = this.historyService.annotateWithChange(all);

    // Pick the latest record per (state, market) — that is the "today"
    const latestByMandi = new Map<string, MarketPriceRecord>();
    for (const r of annotated) {
      const k = `${r.state}|${r.market}`;
      const existing = latestByMandi.get(k);
      if (
        !existing ||
        r.arrivalDate.localeCompare(existing.arrivalDate) > 0
      ) {
        latestByMandi.set(k, r);
      }
    }

    const rows: MarketComparisonRow[] = Array.from(latestByMandi.values())
      .slice(0, limit)
      .map(r => ({
        market: r.market,
        state: r.state,
        district: r.district,
        commodity: r.commodity,
        modalPrice: r.modalPrice,
        minPrice: r.minPrice,
        maxPrice: r.maxPrice,
        unit: r.unit,
        arrivalDate: r.arrivalDate,
        source: r.source,
        sourceSystem: r.sourceSystem,
      }));

    // 5-factor scoring (PHASE 1 §P2.4).
    const scored = scoreRows(rows);
    const top = scored[0];

    return {
      rows,
      recommendation: top
        ? {
            market: top.row.market,
            state: top.row.state,
            district: top.row.district,
            commodity: top.row.commodity,
            modalPrice: top.row.modalPrice,
            unit: top.row.unit,
            arrivalDate: top.row.arrivalDate,
            source: top.row.source,
            sourceSystem: top.row.sourceSystem,
            reasons: top.reasons,
            score: top.score,
            breakdown: top.breakdown,
          }
        : null,
      isDemo: rows.length === 0,
      isDegraded: isDegradedMode(),
      fetchedAt: new Date().toISOString(),
    };
  }
}

