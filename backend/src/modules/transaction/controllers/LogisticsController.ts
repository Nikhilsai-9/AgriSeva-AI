/**
 * LogisticsController — REST endpoints for logistics options and bookings.
 *
 * Endpoints (all under /api):
 *   GET    /logistics/options         — list all transport options (PUBLIC — seeded)
 *   GET    /logistics/bookings        — list bookings for authenticated farmer
 *   POST   /logistics/bookings        — create a logistics booking (auth required)
 *
 * Authentication: `/options` is a public read of static seeded data;
 * `/bookings*` require a valid Firebase ID token. The authenticated
 * principal's Mongo `_id` is the source of truth for ownership checks.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Authorized,
  Get,
  Post,
  Body,
  CurrentUser,
  HttpCode,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {LogisticsRepository} from '../repositories/LogisticsRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import {NotificationService} from '#root/modules/notification/services/NotificationService.js';
import type {IUser} from '#root/shared/interfaces/models.js';
import type {LogisticsBookingRecord, LogisticsVehicleType} from '../types.js';
import {LogisticsBookingBody} from '../validators/TransactionValidators.js';

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function farmerIdOf(user: IUser): string {
  return user._id!.toString();
}

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/logistics')
export class LogisticsController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionLogisticsRepository)
    private readonly logistics: LogisticsRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
    @inject(GLOBAL_TYPES.NotificationService)
    private readonly notifications: NotificationService,
  ) {}

  // ── Public: logistics options are seeded static data ───────────────
  @Get('/options')
  @HttpCode(200)
  async listOptions(): Promise<{
    success: boolean;
    options: unknown[];
    isDemo: boolean;
  }> {
    await this.seed.ensureSeeded();
    const options = await this.logistics.findAllOptions();
    return {
      success: true,
      options,
      isDemo: options.length > 0 && options.every((o) => o.isDemo),
    };
  }

  // ── Authenticated ───────────────────────────────────────────────────
  @Authorized()
  @Get('/bookings')
  @HttpCode(200)
  async listBookings(
    @CurrentUser() user: IUser,
  ): Promise<{
    success: boolean;
    bookings: LogisticsBookingRecord[];
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const bookings = await this.logistics.findBookingsByFarmer(farmerId);
    return {success: true, bookings, total: bookings.length};
  }

  @Authorized()
  @Post('/bookings')
  @HttpCode(201)
  async createBooking(
    @CurrentUser() user: IUser,
    @Body() body: LogisticsBookingBody,
  ): Promise<{success: boolean; booking: LogisticsBookingRecord}> {
    const farmerId = farmerIdOf(user);
    const option = await this.logistics.findOptionById(body.logisticsId);
    if (!option) {
      throw new NotFoundError(`Logistics option ${body.logisticsId} not found`);
    }
    if (body.lotId) {
      const lot = await this.lots.findByIdForFarmer(body.lotId, farmerId);
      if (!lot) {
        const exists = await this.lots.findById(body.lotId);
        if (exists) {
          throw new ForbiddenError('Lot does not belong to this farmer');
        }
      }
    }
    const now = new Date().toISOString();
    const record: LogisticsBookingRecord = {
      id: randomId('lb'),
      farmerId,
      logisticsId: body.logisticsId,
      providerName: body.providerName ?? option.providerName,
      vehicleType: (body.vehicleType ?? option.vehicleType) as LogisticsVehicleType,
      capacityTons: option.capacityTons,
      estimatedHours: option.estimatedHours,
      costPerKm: option.costPerKm,
      distanceKm: body.distanceKm ?? option.distanceKm,
      estimatedCost: body.estimatedCost ?? option.estimatedCost,
      insured: option.insured,
      fromLocation: option.fromLocation,
      toLocation: option.toLocation,
      expectedArrival: body.expectedArrival ?? null,
      lotId: body.lotId ?? null,
      lotSummary: body.lotSummary,
      status: 'confirmed',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.logistics.insertBooking(record);
    void this.notifications
      .saveTheNotifications(
        `Logistics booked: ${record.providerName} (${record.vehicleType}, ETA ${record.estimatedHours}h).`,
        'Logistics Booked',
        record.id,
        farmerId,
        'logistics_booked',
      )
      .catch((err) => console.error('[LogisticsController.createBooking] notif failed', err));
    return {success: true, booking: record};
  }
}
