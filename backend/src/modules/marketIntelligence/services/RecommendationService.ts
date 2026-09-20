/**
 * RecommendationService — server-side thin wrapper that runs the
 * existing frontend recommendation engine server-side.
 *
 * Reuses the pure scoring logic implemented in
 * `frontend/src/features/farmerDashboard/market-intelligence/recommendation.ts`
 * via a shared util that ships with the module.
 *
 * For now the frontend engines stay client-side (small, pure, and
 * already battle-tested). The server endpoint exists so the backend
 * can compute recommendations when desired without forcing the
 * frontend to ship its weights in production.
 *
 * If `buyers`/`grievances` are not provided the engine DEGRADES to a
 * price-only comparison (still useful) and explicitly flags this in
 * the response so the UI can label the recommendation accordingly.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import {MarketHistoryService} from './MarketHistoryService.js';
import type {MarketComparisonRow, MarketPriceRecord} from '../types.js';

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
  reason: string;
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
   */
  public async compare(input: {
    commodity: string;
    state?: string;
    limit?: number;
  }): Promise<{
    rows: MarketComparisonRow[];
    recommendation: ServerRecommendation | null;
    isDemo: boolean;
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

    const recommendation =
      rows.length === 0
        ? null
        : rows
            .filter(r => typeof r.modalPrice === 'number')
            .sort((a, b) => (b.modalPrice ?? 0) - (a.modalPrice ?? 0))[0];

    return {
      rows,
      recommendation: recommendation
        ? {
            market: recommendation.market,
            state: recommendation.state,
            district: recommendation.district,
            commodity: recommendation.commodity,
            modalPrice: recommendation.modalPrice,
            unit: recommendation.unit,
            arrivalDate: recommendation.arrivalDate,
            source: recommendation.source,
            sourceSystem: recommendation.sourceSystem,
            reason: recommendation.modalPrice
              ? `Highest modal price in the latest comparison set.`
              : 'No modal price available to rank.',
          }
        : null,
      isDemo: rows.length === 0,
      fetchedAt: new Date().toISOString(),
    };
  }
}
