/**
 * MarketInsightController — `/market-insights/today` headline endpoint.
 *
 * Returns the most-relevant mandi+price for a (state, commodity)
 * tuple, with the change% vs the previous comparable session.
 * When the backend has no records the response is flagged
 * `isDemo: true` so the UI can fall back to the demo insight clearly.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  QueryParams,
  BadRequestError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import {MarketHistoryService} from '../services/MarketHistoryService.js';
import {CommodityResolver} from '../services/CommodityResolver.js';
import {GetTodayInsightQuery} from '../validators/MarketValidators.js';
import type {MarketTodayInsight} from '../types.js';

@OpenAPI({
  tags: ['market-intelligence'],
  description: "Today's headline market insight for a crop.",
})
@injectable()
@JsonController('/market-insights')
export class MarketInsightController {
  constructor(
    @inject(GLOBAL_TYPES.MarketPriceRepository)
    private readonly priceRepo: MarketPriceRepository,

    @inject(GLOBAL_TYPES.MarketHistoryService)
    private readonly historyService: MarketHistoryService,

    @inject(GLOBAL_TYPES.CommodityResolver)
    private readonly commodityResolver: CommodityResolver,
  ) {}

  @OpenAPI({
    summary: "Today's headline insight",
    description:
      'Returns the most-recent record matching state+commodity ' +
      '(market optional) with change% vs the previous comparable ' +
      'session. Returns null insight if no matching records exist.',
  })
  @Get('/today')
  @HttpCode(200)
  async today(
    @QueryParams() query: GetTodayInsightQuery,
  ): Promise<{
    success: boolean;
    isDemo: boolean;
    fetchedAt: string;
    insight: MarketTodayInsight | null;
  }> {
    if (!query.commodity) {
      throw new BadRequestError('commodity is required');
    }

    const filter: any = {};
    const resolved = await this.commodityResolver.resolve(query.commodity);
    const candidates = resolved.candidates;
    filter.commodity =
      candidates.length > 1 ? {$in: candidates} : candidates[0];
    if (query.state) filter.state = query.state;
    if (query.market) filter.market = query.market;

    let rows = (await this.priceRepo.findMany(filter, 20)) ?? [];

    if (rows.length === 0 && filter.commodity && (filter.state || filter.market)) {
      // Relax state/market filter to return active mandis across India for this commodity
      const relaxedFilter = { ...filter };
      delete relaxedFilter.state;
      delete relaxedFilter.market;
      rows = (await this.priceRepo.findMany(relaxedFilter, 20)) ?? [];
    }

    if (rows.length === 0) {
      return {
        success: true,
        isDemo: true,
        fetchedAt: new Date().toISOString(),
        insight: null,
      };
    }
    const annotated = this.historyService.annotateWithChange(rows);
    // Defence-in-depth: repository already projects out `_id`, but
    // strip again here so the insight payload never leaks it.
    const latest = annotated
      .map(stripMongoId)
      .sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate))[0];

    return {
      success: true,
      isDemo: false,
      fetchedAt: new Date().toISOString(),
      insight: {
        commodity: latest.commodity,
        market: latest.market,
        state: latest.state,
        district: latest.district,
        modalPrice: latest.modalPrice,
        minPrice: latest.minPrice,
        maxPrice: latest.maxPrice,
        unit: latest.unit,
        arrivalDate: latest.arrivalDate,
        source: latest.source,
        sourceSystem: latest.sourceSystem,
        trendPct: latest.trendPct ?? null,
        changePct: latest.changePct ?? null,
        isDemo: false,
        fetchedAt: latest.ingestedAt,
      },
    };
  }
}

function stripMongoId<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const obj = row as T & {_id?: unknown};
  if (!('_id' in obj)) return row;
  const {_id: _drop, ...rest} = obj;
  return rest as unknown as T;
}
