import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {Type} from 'class-transformer';

/**
 * Query DTO for `GET /api/market-prices`.
 *
 * All filters are optional; an empty query returns the most recent
 * 50 records for all states/commodities.
 */
class GetMarketPricesQuery {
  @JSONSchema({description: 'Filter by state', example: 'Karnataka', type: 'string'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'Filter by district', example: 'Kolar', type: 'string'})
  @IsOptional()
  @IsString()
  district?: string;

  @JSONSchema({description: 'Filter by mandi/market', example: 'Kolar Mandi', type: 'string'})
  @IsOptional()
  @IsString()
  market?: string;

  @JSONSchema({description: 'Filter by commodity', example: 'Tomato', type: 'string'})
  @IsOptional()
  @IsString()
  commodity?: string;

  @JSONSchema({description: 'Filter by variety', example: 'Hybrid', type: 'string'})
  @IsOptional()
  @IsString()
  variety?: string;

  @JSONSchema({description: 'ISO date YYYY-MM-DD', example: '2026-04-15', type: 'string'})
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @JSONSchema({description: 'Page number', example: 1, type: 'number'})
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @JSONSchema({description: 'Items per page', example: 50, type: 'number'})
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number;
}

class GetMarketHistoryQuery {
  @JSONSchema({description: 'State (required for history)', example: 'Karnataka'})
  @IsString()
  state!: string;

  @JSONSchema({description: 'Mandi name', example: 'Kolar Mandi'})
  @IsString()
  market!: string;

  @JSONSchema({description: 'Commodity', example: 'Tomato'})
  @IsString()
  commodity!: string;

  @JSONSchema({description: 'Variety (optional)', example: 'Hybrid'})
  @IsOptional()
  @IsString()
  variety?: string;

  @JSONSchema({description: 'Lookback window in days', example: 30, type: 'number'})
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(365)
  lookbackDays?: number;
}

class GetMarketComparisonQuery {
  @JSONSchema({description: 'Commodity', example: 'Tomato'})
  @IsString()
  commodity!: string;

  @JSONSchema({description: 'Filter to a state', example: 'Karnataka'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'Max rows', example: 25, type: 'number'})
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

class GetTodayInsightQuery {
  @JSONSchema({description: 'Commodity', example: 'Tomato'})
  @IsString()
  commodity!: string;

  @JSONSchema({description: 'State', example: 'Karnataka'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'Mandi name', example: 'Kolar Mandi'})
  @IsOptional()
  @IsString()
  market?: string;
}

class RefreshMarketPricesBody {
  @JSONSchema({description: 'State to refresh', example: 'Karnataka'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'Commodity to refresh', example: 'Tomato'})
  @IsOptional()
  @IsString()
  commodity?: string;

  @JSONSchema({description: 'Mandi (optional, for targeted refresh)', example: 'Kolar Mandi'})
  @IsOptional()
  @IsString()
  market?: string;

  @JSONSchema({description: 'ISO date YYYY-MM-DD', example: '2026-04-15'})
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @JSONSchema({description: 'Run with eager (Agmarknet+eNAM)', example: false, type: 'boolean'})
  @IsOptional()
  includeFallback?: boolean;
}

class MarketReliabilityQuery {
  @JSONSchema({description: 'Source id', example: 'agmarknet'})
  @IsOptional()
  @IsIn(['agmarknet', 'enam'])
  source?: 'agmarknet' | 'enam';
}

export {
  GetMarketPricesQuery,
  GetMarketHistoryQuery,
  GetMarketComparisonQuery,
  GetTodayInsightQuery,
  RefreshMarketPricesBody,
  MarketReliabilityQuery,
};

export const MARKET_VALIDATORS = [
  GetMarketPricesQuery,
  GetMarketHistoryQuery,
  GetMarketComparisonQuery,
  GetTodayInsightQuery,
  RefreshMarketPricesBody,
  MarketReliabilityQuery,
];
