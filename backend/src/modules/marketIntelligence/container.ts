/**
 * Inversify container for the market-intelligence module.
 * Mirrors the crop module's `container.ts` shape.
 */

import {ContainerModule} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';

import {AgmarknetMcpClient} from './mcp/agmarknetClient.js';
import {EnamMcpClient} from './mcp/enamClient.js';

import {MarketPriceRepository} from './repositories/MarketPriceRepository.js';
import {MandiRepository} from './repositories/MandiRepository.js';
import {CommodityAliasRepository} from './repositories/CommodityAliasRepository.js';
import {DataUpdateLogRepository} from './repositories/DataUpdateLogRepository.js';

import {MarketNormaliser} from './services/MarketNormaliser.js';
import {MarketHistoryService} from './services/MarketHistoryService.js';
import {MarketReliabilityService} from './services/ReliabilityService.js';
import {MarketIngestionService} from './services/MarketIngestionService.js';
import {CommodityResolver} from './services/CommodityResolver.js';
import {RecommendationService} from './services/RecommendationService.js';

import {MarketPricesController} from './controllers/MarketPricesController.js';
import {MarketComparisonController} from './controllers/MarketComparisonController.js';
import {MarketInsightController} from './controllers/MarketInsightController.js';
import {MarketHealthController} from './controllers/MarketHealthController.js';

export const marketIntelligenceContainerModule = new ContainerModule(options => {
  // MCP clients
  options.bind(GLOBAL_TYPES.AgmarknetMcpClient).to(AgmarknetMcpClient).inSingletonScope();
  options.bind(GLOBAL_TYPES.EnamMcpClient).to(EnamMcpClient).inSingletonScope();

  // Repositories
  options.bind(GLOBAL_TYPES.MarketPriceRepository).to(MarketPriceRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.MandiRepository).to(MandiRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.CommodityAliasRepository).to(CommodityAliasRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.DataUpdateLogRepository).to(DataUpdateLogRepository).inSingletonScope();

  // Services
  options.bind(GLOBAL_TYPES.MarketNormaliserService).to(MarketNormaliser).inSingletonScope();
  options.bind(GLOBAL_TYPES.MarketHistoryService).to(MarketHistoryService).inSingletonScope();
  options.bind(GLOBAL_TYPES.MarketReliabilityService).to(MarketReliabilityService).inSingletonScope();
  options.bind(GLOBAL_TYPES.MarketIngestionService).to(MarketIngestionService).inSingletonScope();
  options.bind(GLOBAL_TYPES.CommodityResolver).to(CommodityResolver).inSingletonScope();
  options.bind(GLOBAL_TYPES.RecommendationService).to(RecommendationService).inSingletonScope();

  // Controllers
  options.bind(MarketPricesController).toSelf().inSingletonScope();
  options.bind(MarketComparisonController).toSelf().inSingletonScope();
  options.bind(MarketInsightController).toSelf().inSingletonScope();
  options.bind(MarketHealthController).toSelf().inSingletonScope();
});
