/**
 * BuyerController — REST endpoints for buyer directory.
 *
 * Endpoints (all under /api):
 *   GET   /buyers                 — list with optional filters (auth required)
 *   GET   /buyers/:id             — single buyer (auth required)
 *   PATCH /buyers/:id/verify      — admin-only verification status update
 *
 * Important: this directory is demo data. The verification status field
 * tracks DEMO flag values, NOT real KYC results. Verification mutation
 * is gated to admin/moderator roles; listing is open to any authenticated
 * user (the frontend farmer dashboard depends on it for buyer discovery).
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
  Authorized,
  Get,
  Patch,
  Param,
  Body,
  QueryParams,
  HttpCode,
  NotFoundError,
  BadRequestError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {GLOBAL_TYPES} from '#root/types.js';
import {BuyerRepository} from '../repositories/BuyerRepository.js';
import {SeedLoader} from '../services/SeedLoader.js';
import type {BuyerRecord, VerificationStatus} from '../types.js';
import {BuyerListQuery, BuyerIdParam, BuyerVerificationBody} from '../validators/TransactionValidators.js';

@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/buyers')
export class BuyerController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionBuyerRepository)
    private readonly buyers: BuyerRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
  ) {}

  // List + read: any authenticated user (farmer dashboard depends on
  // this for buyer discovery).
  @Authorized()
  @Get('/')
  @HttpCode(200)
  async list(@QueryParams() query: BuyerListQuery): Promise<{
    success: boolean;
    buyers: BuyerRecord[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const filter: Record<string, unknown> = {};
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
    if (query.businessType) filter.businessType = query.businessType;
    if (query.state) filter.state = query.state;
    if (query.crop) filter.cropsInterested = {$regex: query.crop, $options: 'i'};
    const records = await this.buyers.findMany(filter);
    return {
      success: true,
      buyers: records,
      isDemo: records.length > 0 && records.every((b) => b.isDemo),
      total: records.length,
    };
  }

  @Authorized()
  @Get('/:id')
  @HttpCode(200)
  async byId(@Param('id') id: string): Promise<{success: boolean; buyer: BuyerRecord}> {
    await this.seed.ensureSeeded();
    const buyer = await this.buyers.findById(id);
    if (!buyer) {
      throw new NotFoundError(`Buyer ${id} not found`);
    }
    return {success: true, buyer};
  }

  // Verification mutation: admin/moderator only. Without role gating
  // any authenticated user could mark a buyer "verified" and the field
  // is rendered as a trust signal in the UI.
  @Authorized(['admin', 'moderator'])
  @Patch('/:id/verify')
  @HttpCode(200)
  async updateVerification(
    @Param('id') id: string,
    @Body() body: BuyerVerificationBody,
  ): Promise<{success: boolean; buyer: BuyerRecord}> {
    const status: VerificationStatus = body.verificationStatus;
    if (!['unverified', 'pending', 'verified', 'rejected'].includes(status)) {
      throw new BadRequestError('Invalid verification status');
    }
    const updated = await this.buyers.updateVerificationStatus(id, status);
    if (!updated) {
      throw new NotFoundError(`Buyer ${id} not found`);
    }
    return {success: true, buyer: updated};
  }
}
