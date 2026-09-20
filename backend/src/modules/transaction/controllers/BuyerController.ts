/**
 * BuyerController — REST endpoints for buyer directory.
 *
 * Endpoints (all under /api):
 *   GET  /buyers                  — list with optional filters
 *   GET  /buyers/:id              — single buyer
 *   PATCH /buyers/:id/verify      — admin-style verification status update
 *
 * Important: this directory is demo data. The verification status field
 * tracks DEMO flag values, NOT real KYC results.
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {
  JsonController,
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
