/**
 * MarketComparisonController — cross-mandi comparison endpoint.
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
import {RecommendationService} from '../services/RecommendationService.js';
import {GetMarketComparisonQuery} from '../validators/MarketValidators.js';

@OpenAPI({
  tags: ['market-intelligence'],
  description: 'Cross-mandi comparison for a commodity.',
})
@injectable()
@JsonController('/market-comparison')
export class MarketComparisonController {
  constructor(
    @inject(GLOBAL_TYPES.RecommendationService)
    private readonly recommendationService: RecommendationService,
  ) {}

  @OpenAPI({
    summary: 'Compare the latest record per mandi for a commodity',
  })
  @Get('/')
  @HttpCode(200)
  async compare(
    @QueryParams() query: GetMarketComparisonQuery,
  ) {
    if (!query.commodity) {
      throw new BadRequestError('commodity is required');
    }
    const r = await this.recommendationService.compare({
      commodity: query.commodity,
      state: query.state,
      limit: query.limit,
    });
    return {
      success: true,
      isDemo: r.isDemo,
      isDegraded: r.isDegraded,
      fetchedAt: r.fetchedAt,
      commodity: query.commodity,
      rows: r.rows,
      recommendation: r.recommendation,
    };
  }
}
