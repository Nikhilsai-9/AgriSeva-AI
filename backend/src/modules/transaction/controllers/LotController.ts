/**
 * LotController — REST endpoints for farmer lots.
 *
 * Endpoints (all under /api):
 *   GET    /lots                — list (scoped to authenticated farmer)
 *   GET    /lots/:id            — single lot (ownership-checked)
 *   POST   /lots                — create lot
 *   PATCH  /lots/:id            — partial update
 *   DELETE /lots/:id            — soft delete (status -> 'expired')
 *   POST   /lots/:id/sell       — manual mark-as-sold cascade
 *
 * Authentication: every endpoint requires a valid Firebase ID token in
 * the `Authorization: Bearer <token>` header. The principal id (the
 * authenticated user's Mongo `_id`) is the source of truth for
 * ownership checks — no client-supplied `x-demo-farmer-id` header is
 * trusted. Mutations that affect the farmer's lots also fire a
 * `NotificationService.saveTheNotifications(...)` so the bell icon is
 * driven by real backend events instead of synthetic derivations.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Authorized,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  QueryParams,
  CurrentUser,
  HttpCode,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {OfferRepository} from '../repositories/OfferRepository.js';
import {PaymentRepository} from '../repositories/PaymentRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import {NotificationService} from '#root/modules/notification/services/NotificationService.js';
import type {IUser} from '#root/shared/interfaces/models.js';
import type {LotRecord, LotStatus, PaymentRecordDoc, QualityGrade} from '../types.js';
import {
  LotListQuery,
  LotIdParam,
  CreateLotBody,
  UpdateLotBody,
  MarkLotSoldBody,
} from '../validators/TransactionValidators.js';

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Resolve the authenticated farmer id from the IUser principal. */
function farmerIdOf(user: IUser): string {
  return user._id!.toString();
}

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/lots')
export class LotController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionOfferRepository)
    private readonly offers: OfferRepository,
    @inject(GLOBAL_TYPES.TransactionPaymentRepository)
    private readonly payments: PaymentRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
    @inject(GLOBAL_TYPES.NotificationService)
    private readonly notifications: NotificationService,
  ) {}

  @Authorized()
  @Get('/')
  @HttpCode(200)
  async list(
    @CurrentUser() user: IUser,
    @QueryParams() query: LotListQuery,
  ): Promise<{success: boolean; lots: LotRecord[]; isDemo: boolean; total: number}> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const filter: Record<string, unknown> = {farmerId};
    if (query.status) filter.status = query.status;
    if (query.crop) filter.crop = {$regex: query.crop, $options: 'i'};
    const records = await this.lots.findMany(filter);
    return {
      success: true,
      lots: records,
      isDemo: records.length > 0 && records.every((l) => l.isDemo),
      total: records.length,
    };
  }

  @Authorized()
  @Get('/:id')
  @HttpCode(200)
  async byId(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; lot: LotRecord}> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const lot = await this.lots.findById(id);
    if (!lot) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    if (lot.farmerId !== farmerId) {
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    return {success: true, lot};
  }

  @Authorized()
  @Post('/')
  @HttpCode(201)
  async create(
    @CurrentUser() user: IUser,
    @Body() body: CreateLotBody,
  ): Promise<{success: boolean; lot: LotRecord}> {
    await this.seed.ensureSeeded();
    const farmerId = farmerIdOf(user);
    const now = new Date().toISOString();
    const record: LotRecord = {
      id: randomId('lot'),
      farmerId,
      crop: body.crop,
      variety: body.variety,
      quantityKg: body.quantityKg,
      qualityGrade: body.qualityGrade as QualityGrade,
      qualityNotes: body.qualityNotes,
      expectedPricePerKg: body.expectedPricePerKg,
      state: body.state,
      district: body.district,
      village: body.village ?? '',
      harvestDate: body.harvestDate,
      images: body.images ?? [],
      notes: body.notes,
      status: (body.status ?? 'draft') as LotStatus,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.lots.insert(record);
    // Fire-and-forget notification. Failures here MUST NOT block the
    // create response.
    void this.notifications
      .saveTheNotifications(
        `Lot "${record.crop}" (${record.quantityKg}kg) is now active.`,
        'New Lot Listed',
        record.id,
        farmerId,
        'lot_created',
      )
      .catch((err) => console.error('[LotController.create] notif failed', err));
    return {success: true, lot: record};
  }

  @Authorized()
  @Patch('/:id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLotBody,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; lot: LotRecord}> {
    const farmerId = farmerIdOf(user);
    const existing = await this.lots.findById(id);
    if (!existing) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    if (existing.farmerId !== farmerId) {
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    if (existing.status === 'sold') {
      throw new ForbiddenError('Cannot modify a sold lot');
    }
    const patch: Partial<LotRecord> = {};
    if (body.crop !== undefined) patch.crop = body.crop;
    if (body.variety !== undefined) patch.variety = body.variety;
    if (body.quantityKg !== undefined) patch.quantityKg = body.quantityKg;
    if (body.qualityGrade !== undefined) patch.qualityGrade = body.qualityGrade as QualityGrade;
    if (body.qualityNotes !== undefined) patch.qualityNotes = body.qualityNotes;
    if (body.expectedPricePerKg !== undefined) patch.expectedPricePerKg = body.expectedPricePerKg;
    if (body.state !== undefined) patch.state = body.state;
    if (body.district !== undefined) patch.district = body.district;
    if (body.village !== undefined) patch.village = body.village;
    if (body.harvestDate !== undefined) patch.harvestDate = body.harvestDate;
    if (body.images !== undefined) patch.images = body.images;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.status !== undefined) patch.status = body.status as LotStatus;
    const updated = await this.lots.update(id, patch);
    if (!updated) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    // Status changed -> notify the owner. (Field edits are silent.)
    if (body.status !== undefined && body.status !== existing.status) {
      void this.notifications
        .saveTheNotifications(
          `Lot "${updated.crop}" status: ${existing.status} -> ${updated.status}.`,
          'Lot Status Updated',
          updated.id,
          farmerId,
          'lot_status_changed',
        )
        .catch((err) => console.error('[LotController.update] notif failed', err));
    }
    return {success: true, lot: updated};
  }

  @Authorized()
  @Delete('/:id')
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; lot: LotRecord}> {
    const farmerId = farmerIdOf(user);
    const existing = await this.lots.findById(id);
    if (!existing) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    if (existing.farmerId !== farmerId) {
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    if (existing.status === 'sold') {
      throw new ForbiddenError('Cannot delete a sold lot');
    }
    const updated = await this.lots.update(id, {status: 'expired'});
    if (!updated) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    return {success: true, lot: updated};
  }

  @Authorized()
  @Post('/:id/sell')
  @HttpCode(200)
  async markSold(
    @Param('id') id: string,
    @Body() body: MarkLotSoldBody,
    @CurrentUser() user: IUser,
  ): Promise<{success: boolean; lot: LotRecord; rejectedSiblings: number; payment?: PaymentRecordDoc}> {
    const farmerId = farmerIdOf(user);
    const lot = await this.lots.findById(id);
    if (!lot) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    if (lot.farmerId !== farmerId) {
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    if (lot.status === 'sold') {
      throw new ForbiddenError('Lot is already sold');
    }
    const now = new Date().toISOString();
    const updatedLot = await this.lots.update(id, {status: 'sold'});
    if (!updatedLot) {
      throw new NotFoundError(`Lot ${id} not found`);
    }
    const rejectedSiblings = await this.offers.rejectSiblings(id, body.winningOfferId ?? '__none__');
    void this.notifications
      .saveTheNotifications(
        `Lot "${updatedLot.crop}" has been marked sold. ${rejectedSiblings ?? 0} other offer(s) rejected.`,
        'Lot Sold',
        updatedLot.id,
        farmerId,
        'lot_status_changed',
      )
      .catch((err) => console.error('[LotController.markSold] notif failed', err));
    let payment: PaymentRecordDoc | undefined;
    if (body.winningOfferId) {
      const winningOffer = await this.offers.findById(body.winningOfferId);
      if (winningOffer && winningOffer.lotId === id) {
        await this.offers.transition(body.winningOfferId, ['pending', 'countered'], 'accepted');
        const existingPayment = await this.payments.findActiveByLot(id);
        if (!existingPayment) {
          payment = {
            id: randomId('pay'),
            lotId: id,
            buyerId: winningOffer.buyerId,
            buyerName: winningOffer.buyerName,
            crop: winningOffer.crop,
            quantityKg: winningOffer.quantityKg,
            amount: winningOffer.amount,
            status: 'pending',
            reference: `PAY-${Date.now().toString(36).toUpperCase()}`,
            method: 'NEFT',
            lotSummary: `${winningOffer.crop} - ${winningOffer.quantityKg}kg`,
            timeline: [
              {label: 'Lot Created', status: 'done', timestamp: lot.createdAt},
              {label: 'Buyer Offer', status: 'done', timestamp: winningOffer.createdAt},
              {label: 'Offer Accepted', status: 'done', timestamp: now},
              {label: 'Delivered', status: 'current', timestamp: null},
              {label: 'Payment Processing', status: 'current', timestamp: null},
              {label: 'Payment Received', status: 'upcoming', timestamp: null},
            ],
            farmerId,
            isDemo: false,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          };
          await this.payments.insert(payment);
        }
      }
    }
    return {success: true, lot: updatedLot, rejectedSiblings, payment};
  }
}
