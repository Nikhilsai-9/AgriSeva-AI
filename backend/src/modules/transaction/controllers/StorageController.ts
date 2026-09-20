/**
 * StorageController — REST endpoints for storage options and bookings.
 *
 * Endpoints (all under /api):
 *   GET    /storage/options           — list all storage options (seeded)
 *   GET    /storage/bookings          — list bookings for current farmer
 *   POST   /storage/bookings          — create a booking reservation
 *
 * Demo data only — no live warehouse capacity tracking.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Get,
  Post,
  Body,
  HeaderParam,
  HttpCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {StorageRepository} from '../repositories/StorageRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import type {StorageBookingRecord} from '../types.js';
import {StorageBookingBody} from '../validators/TransactionValidators.js';

const DEMO_HEADER = 'x-demo-farmer-id';

function resolveFarmerId(header?: string): string {
  return header && header.trim() ? header.trim() : 'demo-farmer-uid';
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/storage')
export class StorageController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionStorageRepository)
    private readonly storage: StorageRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
  ) {}

  @Get('/options')
  @HttpCode(200)
  async listOptions(): Promise<{
    success: boolean;
    options: unknown[];
    isDemo: boolean;
  }> {
    await this.seed.ensureSeeded();
    const options = await this.storage.findAllOptions();
    return {
      success: true,
      options,
      isDemo: options.length > 0 && options.every((o) => o.isDemo),
    };
  }

  @Get('/bookings')
  @HttpCode(200)
  async listBookings(
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    bookings: StorageBookingRecord[];
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const bookings = await this.storage.findBookingsByFarmer(farmerId);
    return {success: true, bookings, total: bookings.length};
  }

  @Post('/bookings')
  @HttpCode(201)
  async createBooking(
    @Body() body: StorageBookingBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; booking: StorageBookingRecord}> {
    const farmerId = resolveFarmerId(farmerHeader);
    const option = await this.storage.findOptionById(body.storageId);
    if (!option) {
      throw new NotFoundError(`Storage option ${body.storageId} not found`);
    }
    if (body.reservedKg > option.availableTons * 1000) {
      throw new BadRequestError(
        `Reservation ${body.reservedKg}kg exceeds available ${option.availableTons} tons`,
      );
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
    const record: StorageBookingRecord = {
      id: randomId('sb'),
      farmerId,
      storageId: body.storageId,
      storageName: option.facilityName,
      storageType: body.storageType,
      facilityType: option.facilityType,
      state: option.state,
      district: option.district,
      reservedKg: body.reservedKg,
      durationDays: body.durationDays,
      endDate: new Date(
        Date.now() + body.durationDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      expectedArrival: body.expectedArrival ?? null,
      totalCost:
        body.reservedKg *
        option.costPerQuintalPerDay *
        body.durationDays,
      lotId: body.lotId ?? null,
      lotSummary: body.lotSummary,
      status: 'reserved',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.insertBooking(record);
    return {success: true, booking: record};
  }
}
