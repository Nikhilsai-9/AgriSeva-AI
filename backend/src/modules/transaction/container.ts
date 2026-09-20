/**
 * Inversify container for the transaction module.
 *
 * Mirrors the crop / marketIntelligence module conventions so
 * `loadAppModules('all')` picks the bindings up automatically.
 */

import {ContainerModule} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';

import {BuyerRepository} from './repositories/BuyerRepository.js';
import {LotRepository} from './repositories/LotRepository.js';
import {OfferRepository} from './repositories/OfferRepository.js';
import {PaymentRepository} from './repositories/PaymentRepository.js';
import {GrievanceRepository} from './repositories/GrievanceRepository.js';
import {StorageRepository} from './repositories/StorageRepository.js';
import {LogisticsRepository} from './repositories/LogisticsRepository.js';

import {OfferService} from './services/OfferService.js';
import {SeedLoader} from './services/SeedLoader.js';

import {BuyerController} from './controllers/BuyerController.js';
import {LotController} from './controllers/LotController.js';
import {OfferController, LotOffersController} from './controllers/OfferController.js';
import {PaymentController} from './controllers/PaymentController.js';
import {GrievanceController} from './controllers/GrievanceController.js';
import {StorageController} from './controllers/StorageController.js';
import {LogisticsController} from './controllers/LogisticsController.js';

export const transactionContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(GLOBAL_TYPES.TransactionBuyerRepository).to(BuyerRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionLotRepository).to(LotRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionOfferRepository).to(OfferRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionPaymentRepository).to(PaymentRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionGrievanceRepository).to(GrievanceRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionStorageRepository).to(StorageRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionLogisticsRepository).to(LogisticsRepository).inSingletonScope();

  // Services
  options.bind(GLOBAL_TYPES.TransactionOfferService).to(OfferService).inSingletonScope();
  options.bind(GLOBAL_TYPES.TransactionSeedLoader).to(SeedLoader).inSingletonScope();

  // Controllers
  options.bind(BuyerController).toSelf().inSingletonScope();
  options.bind(LotController).toSelf().inSingletonScope();
  options.bind(OfferController).toSelf().inSingletonScope();
  options.bind(LotOffersController).toSelf().inSingletonScope();
  options.bind(PaymentController).toSelf().inSingletonScope();
  options.bind(GrievanceController).toSelf().inSingletonScope();
  options.bind(StorageController).toSelf().inSingletonScope();
  options.bind(LogisticsController).toSelf().inSingletonScope();
});
