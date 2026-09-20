/**
 * Module-level wiring for `transaction`.
 *
 * Mirrors the marketIntelligence module so `loadAppModules('all')`
 * picks the controllers, validators and container bindings up
 * automatically.
 */

import {ContainerModule} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {transactionContainerModule} from './container.js';

import {BuyerController} from './controllers/BuyerController.js';
import {LotController} from './controllers/LotController.js';
import {OfferController, LotOffersController} from './controllers/OfferController.js';
import {PaymentController} from './controllers/PaymentController.js';
import {GrievanceController} from './controllers/GrievanceController.js';
import {StorageController} from './controllers/StorageController.js';
import {LogisticsController} from './controllers/LogisticsController.js';

import {TRANSACTION_VALIDATORS} from './validators/TransactionValidators.js';

export const transactionModuleControllers: Function[] = [
  BuyerController,
  LotController,
  OfferController,
  LotOffersController,
  PaymentController,
  GrievanceController,
  StorageController,
  LogisticsController,
];

export const transactionModuleValidators: Function[] = [...TRANSACTION_VALIDATORS];

export const transactionContainerModules: ContainerModule[] = [
  transactionContainerModule,
  sharedContainerModule,
];
