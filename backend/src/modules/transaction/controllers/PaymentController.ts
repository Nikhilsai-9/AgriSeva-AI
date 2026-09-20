/**
 * PaymentController — REST endpoints for payment records.
 *
 * These are TRANSACTION RECORDS ONLY. We do not integrate a real
 * payment gateway. The `reference` field is treated as a free-text
 * transaction number so any real reference can be persisted later.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Get,
  Post,
  Patch,
  Param,
  Body,
  QueryParams,
  HeaderParam,
  HttpCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {PaymentRepository} from '../repositories/PaymentRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import type {PaymentRecordDoc, PaymentStatus, PaymentTimelineEvent} from '../types.js';
import {
  PaymentListQuery,
  PaymentIdParam,
  CreatePaymentBody,
  UpdatePaymentBody,
} from '../validators/TransactionValidators.js';

const DEMO_HEADER = 'x-demo-farmer-id';

function resolveFarmerId(header?: string): string {
  return header && header.trim() ? header.trim() : 'demo-farmer-uid';
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/payments')
export class PaymentController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionPaymentRepository)
    private readonly payments: PaymentRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
  ) {}

  @Get('/')
  @HttpCode(200)
  async list(
    @QueryParams() query: PaymentListQuery,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    payments: PaymentRecordDoc[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const filter: Record<string, unknown> = {farmerId};
    if (query.status) filter.status = query.status;
    if (query.lotId) filter.lotId = query.lotId;
    const records = await this.payments.findMany(filter);
    return {
      success: true,
      payments: records,
      isDemo: records.length > 0 && records.every((p) => p.isDemo),
      total: records.length,
    };
  }

  @Get('/:id')
  @HttpCode(200)
  async byId(
    @Param('id') id: string,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; payment: PaymentRecordDoc}> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError(`Payment ${id} not found`);
    }
    if (payment.farmerId !== farmerId) {
      throw new ForbiddenError('Payment does not belong to this farmer');
    }
    return {success: true, payment};
  }

  @Post('/')
  @HttpCode(201)
  async create(
    @Body() body: CreatePaymentBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; payment: PaymentRecordDoc}> {
    const farmerId = resolveFarmerId(farmerHeader);
    const lot = await this.lots.findByIdForFarmer(body.lotId, farmerId);
    if (!lot) {
      const exists = await this.lots.findById(body.lotId);
      if (!exists) {
        throw new NotFoundError(`Lot ${body.lotId} not found`);
      }
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    const now = new Date().toISOString();
    const reference = body.reference ?? `PAY-${Date.now().toString(36).toUpperCase()}`;
    const status: PaymentStatus = body.status ?? 'pending';
    const timeline: PaymentTimelineEvent[] = [
      {label: 'Lot Created', status: 'done', timestamp: lot.createdAt},
      {label: 'Buyer Offer', status: 'done', timestamp: now},
      {label: 'Offer Accepted', status: 'done', timestamp: now},
      {label: 'Delivered', status: 'current', timestamp: null},
      {label: 'Payment Processing', status: 'current', timestamp: null},
      {label: 'Payment Received', status: 'upcoming', timestamp: null},
    ];
    const record: PaymentRecordDoc = {
      id: randomId('pay'),
      lotId: body.lotId,
      buyerName: body.buyerName,
      crop: body.crop,
      quantityKg: body.quantityKg,
      amount: body.amount,
      status,
      reference,
      method: body.method ?? 'NEFT',
      lotSummary: `${body.crop} - ${body.quantityKg}kg`,
      timeline,
      farmerId,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'completed' || status === 'paid' ? now : null,
    };
    await this.payments.insert(record);
    return {success: true, payment: record};
  }

  @Patch('/:id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePaymentBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; payment: PaymentRecordDoc}> {
    const farmerId = resolveFarmerId(farmerHeader);
    const existing = await this.payments.findById(id);
    if (!existing) {
      throw new NotFoundError(`Payment ${id} not found`);
    }
    if (existing.farmerId !== farmerId) {
      throw new ForbiddenError('Payment does not belong to this farmer');
    }
    const nextStatus = body.status ?? existing.status;
    const completedAt =
      body.completedAt !== undefined
        ? body.completedAt
        : nextStatus === 'completed' || nextStatus === 'paid'
          ? existing.completedAt ?? new Date().toISOString()
          : existing.completedAt;
    const updated = await this.payments.updateStatus(
      id,
      nextStatus,
      completedAt,
    );
    if (!updated) {
      throw new BadRequestError('Failed to update payment record');
    }
    return {success: true, payment: updated};
  }
}