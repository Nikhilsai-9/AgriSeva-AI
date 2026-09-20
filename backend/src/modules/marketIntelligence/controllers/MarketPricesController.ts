/**
 * MarketPricesController — REST endpoints for the Farmer Dashboard
 * market-price surfaces.
 *
 * Endpoints (all under /api):
 *   GET    /market-prices               — list / filter normalised prices
 *   GET    /market-prices/history       — time-series for a mandi/commodity
 *   GET    /market-prices/reliability   — per-source reliability score
 *   POST   /market-prices/refresh       — on-demand targeted ingestion
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Get,
  Post,
  Body,
  HttpCode,
  QueryParams,
  BadRequestError,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import {MarketHistoryService} from '../services/MarketHistoryService.js';
import {MarketReliabilityService} from '../services/ReliabilityService.js';
import {MarketIngestionService} from '../services/MarketIngestionService.js';
import {CommodityResolver} from '../services/CommodityResolver.js';
import {
  GetMarketPricesQuery,
  GetMarketHistoryQuery,
  MarketReliabilityQuery,
  RefreshMarketPricesBody,
} from '../validators/MarketValidators.js';
import type {
  MarketPriceRecord,
  MarketReliabilitySnapshot,
  MarketIngestionResult,
} from '../types.js';

@OpenAPI({
  tags: ['market-intelligence'],
  description:
    'Real mandi prices sourced from Agmarknet (primary) and eNAM ' +
    '(secondary). The backend is the authoritative data boundary for ' +
    'the Farmer Dashboard; never rely on frontend mock rows.',
})
@injectable()
@JsonController('/market-prices')
export class MarketPricesController {
  constructor(
    @inject(GLOBAL_TYPES.MarketPriceRepository)
    private readonly priceRepo: MarketPriceRepository,

    @inject(GLOBAL_TYPES.MarketHistoryService)
    private readonly historyService: MarketHistoryService,

    @inject(GLOBAL_TYPES.MarketReliabilityService)
    private readonly reliabilityService: MarketReliabilityService,

    @inject(GLOBAL_TYPES.MarketIngestionService)
    private readonly ingestionService: MarketIngestionService,

    @inject(GLOBAL_TYPES.CommodityResolver)
    private readonly commodityResolver: CommodityResolver,
  ) {}

  @OpenAPI({
    summary: 'List normalised market prices',
    description:
      'Returns the most-recent records matching the supplied filters. ' +
      'When the live backend has no matching records the response ' +
      'includes `isDemo: true` so the UI can render a clear "no live ' +
      'data" state.',
  })
  @Get('/')
  @HttpCode(200)
  async list(
    @QueryParams() query: GetMarketPricesQuery,
  ): Promise<{
    success: boolean;
    isDemo: boolean;
    source: string;
    fetchedAt: string;
    prices: MarketPriceRecord[];
    total: number;
  }> {
    const limit = Math.min(query.limit ?? 50, 500);
    const filter: any = {};
    if (query.state) filter.state = query.state;
    if (query.district) filter.district = query.district;
    if (query.market) filter.market = query.market;
    if (query.commodity) {
      // Resolve user-supplied commodity via the alias map so a farmer
      // query for "Bajra" still matches "Bajra(Pearl Millet/Cumbu)"
      // (and similar parenthetical disambiguations). The resolver uses
      // EXACT lowercase lookup against commodity_alias — never fuzzy.
      const resolved = await this.commodityResolver.resolve(query.commodity);
      const candidates = resolved.candidates;
      filter.commodity =
        candidates.length > 1 ? {$in: candidates} : candidates[0];
    }
    if (query.variety) filter.variety = query.variety;
    if (query.arrivalDate) filter.arrivalDate = query.arrivalDate;

    const rows = await this.priceRepo.findMany(filter, limit);
    const annotated = this.historyService.annotateWithChange(rows);
    // Defense-in-depth: the repository already projects out MongoDB's
    // internal `_id`, but we re-strip it here so that even if a
    // future caller forgets, the API contract never leaks the DB
    // primary key. `recordKey` is the legitimate public identifier.
    const sanitized = annotated.map(stripMongoId);
    const sources = Array.from(new Set(sanitized.map(r => r.source)));

    return {
      success: true,
      isDemo: annotated.length === 0,
      source: sources.length === 1 ? sources[0] : sources.join('+') || 'none',
      fetchedAt: new Date().toISOString(),
      prices: sanitized,
      total: sanitized.length,
    };
  }

  @OpenAPI({
    summary: 'Time-series prices for a specific mandi+commodity',
  })
  @Get('/history')
  @HttpCode(200)
  async history(
    @QueryParams() query: GetMarketHistoryQuery,
  ): Promise<{
    success: boolean;
    isDemo: boolean;
    state: string;
    market: string;
    commodity: string;
    variety?: string;
    points: Array<{
      arrivalDate: string;
      modalPrice?: number;
      minPrice?: number;
      maxPrice?: number;
      source: string;
    }>;
    fetchedAt: string;
  }> {
    if (!query.state || !query.market || !query.commodity) {
      throw new BadRequestError('state, market and commodity are required');
    }
    const points = await this.historyService.getHistory({
      state: query.state,
      market: query.market,
      commodity: query.commodity,
      variety: query.variety,
      lookbackDays: query.lookbackDays ?? 30,
    });
    return {
      success: true,
      isDemo: points.length === 0,
      state: query.state,
      market: query.market,
      commodity: query.commodity,
      variety: query.variety,
      points: points.map(p => ({...p, source: p.source})),
      fetchedAt: new Date().toISOString(),
    };
  }

  @OpenAPI({
    summary: 'Per-source reliability snapshot',
    description:
      'Returns a 0..100 score and reasons for each upstream market ' +
      'source. The score reflects the source itself, not buyer trust.',
  })
  @Get('/reliability')
  @HttpCode(200)
  async reliability(
    @QueryParams() query: MarketReliabilityQuery,
  ): Promise<{
    success: boolean;
    fetchedAt: string;
    snapshots: MarketReliabilitySnapshot[];
  }> {
    const snapshots = query.source
      ? [await this.reliabilityService.snapshot(query.source)]
      : await this.reliabilityService.snapshotAll();
    return {
      success: true,
      fetchedAt: new Date().toISOString(),
      snapshots,
    };
  }

  @OpenAPI({
    summary: 'On-demand targeted refresh from upstream MCPs',
    description:
      'Triggers an Agmarknet → eNAM ingestion for the supplied target. ' +
      'Records are upserted into `market_prices` and the operation is ' +
      'logged in `data_update_logs`. The endpoint is intentionally cheap ' +
      'and short-circuits when eNAM is requested without state/market.',
  })
  @Post('/refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: RefreshMarketPricesBody,
  ): Promise<{
    success: boolean;
    message: string;
    result: MarketIngestionResult;
  }> {
    const result = await this.ingestionService.ingest(
      {
        state: body.state,
        market: body.market,
        commodity: body.commodity,
        arrivalDate: body.arrivalDate,
      },
      {includeFallback: body.includeFallback ?? true},
    );
    return {
      success: result.success,
      message: result.success
        ? `Ingested ${result.recordsPersisted} rows from ${result.source}.`
        : `Ingestion failed: ${result.errors.join('; ') || 'no source returned rows'}`,
      result,
    };
  }
}

/**
 * Strip MongoDB's internal `_id` from a price record. Returns a
 * fresh object — the original is left untouched. Used as a
 * defense-in-depth layer at the controller boundary so the API
 * contract never leaks the database primary key, regardless of
 * whether the repository-level projection is in place.
 */
function stripMongoId<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const obj = row as T & {_id?: unknown};
  if (!('_id' in obj)) return row;
  const {_id: _drop, ...rest} = obj;
  return rest as unknown as T;
}
