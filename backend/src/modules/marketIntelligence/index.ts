/**
 * Module-level wiring for `marketIntelligence`.
 *
 * This file follows the existing crop/dashboard module convention so
 * `loadAppModules` picks the controllers, validators and container
 * bindings up automatically.
 */

import {ContainerModule} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {marketIntelligenceContainerModule} from './container.js';
import {MarketPricesController} from './controllers/MarketPricesController.js';
import {MarketComparisonController} from './controllers/MarketComparisonController.js';
import {MarketInsightController} from './controllers/MarketInsightController.js';
import {MarketHealthController} from './controllers/MarketHealthController.js';
import {MARKET_VALIDATORS} from './validators/MarketValidators.js';

export const marketIntelligenceModuleControllers: Function[] = [
  MarketPricesController,
  MarketComparisonController,
  MarketInsightController,
  MarketHealthController,
];

export const marketIntelligenceModuleValidators: Function[] = [...MARKET_VALIDATORS];

export const marketIntelligenceContainerModules: ContainerModule[] = [
  marketIntelligenceContainerModule,
  sharedContainerModule,
];
