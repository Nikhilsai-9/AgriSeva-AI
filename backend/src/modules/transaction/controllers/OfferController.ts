/**
 * OfferController - REST endpoints for buyer offers on farmer lots.
 *
 * Endpoints (all under /api):
 *   GET    /offers                    - list with optional filters
 *   GET    /offers/:id                - single offer
 *   POST   /offers                    - create offer
 *   PATCH  /offers/:id                - transition status (accept/reject/withdraw)
 *   POST   /offers/:id/counter        - create a counter-offer (price required)
 *
 * Accept cascade (via OfferService):
 *   1. transition target offer -> accepted
 *   2. verify lot ownership
 *   3. reject sibling offers
 *   4. update lot status -> sold
 *   5. materialize payment record (only when none exists yet)
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
import {OfferRepository} from '../repositories/OfferRepository.js';
import {BuyerRepository} from '../repositories/BuyerRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {OfferService} from '../services/OfferService.js';
import {SeedLoader} from '../services/SeedLoader.js';
import type {OfferRecord} from '../types.js';
import {
  OfferListQuery,
  OfferIdParam,
  LotIdInPathParam,
  CreateOfferBody,
  UpdateOfferBody,
  CounterOfferBody,
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
@JsonController('/offers')
export class OfferController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionOfferRepository)
    private readonly offers: OfferRepository,
    @inject(GLOBAL_TYPES.TransactionBuyerRepository)
    private readonly buyers: BuyerRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionOfferService)
    private readonly offerService: OfferService,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
  ) {}

  @Get('/')
  @HttpCode(200)
  async list(
    @QueryParams() query: OfferListQuery,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    offers: OfferRecord[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.lotId) filter.lotId = query.lotId;
    const records = await this.offers.findMany(filter);
    const lots = await this.lots.findMany({}, 1000);
    const allowedLotIds = new Set(
      lots.filter((l) => l.farmerId === farmerId).map((l) => l.id),
    );
    const scoped =
      query.lotId && !allowedLotIds.has(query.lotId)
        ? []
        : records.filter((r) => allowedLotIds.has(r.lotId));
    return {
      success: true,
      offers: scoped,
      isDemo: scoped.length > 0 && scoped.every((r) => r.isDemo),
      total: scoped.length,
    };
  }

  @Get('/:id')
  @HttpCode(200)
  async byId(@Param('id') id: string): Promise<{success: boolean; offer: OfferRecord}> {
    await this.seed.ensureSeeded();
    const offer = await this.offers.findById(id);
    if (!offer) {
      throw new NotFoundError(`Offer ${id} not found`);
    }
    return {success: true, offer};
  }

  @Post('/')
  @HttpCode(201)
  async create(@Body() body: CreateOfferBody): Promise<{success: boolean; offer: OfferRecord}> {
    await this.seed.ensureSeeded();
    const lot = await this.lots.findById(body.lotId);
    if (!lot) {
      throw new NotFoundError(`Lot ${body.lotId} not found`);
    }
    if (lot.status === 'sold') {
      throw new BadRequestError('Cannot create offer for a lot already sold');
    }
    const buyer = await this.buyers.findById(body.buyerId);
    if (!buyer) {
      throw new NotFoundError(`Buyer ${body.buyerId} not found`);
    }
    const now = new Date().toISOString();
    const quantity = body.quantityKg ?? lot.quantityKg;
    const amount = body.pricePerKg * quantity;
    const record: OfferRecord = {
      id: randomId('offer'),
      lotId: body.lotId,
      buyerId: body.buyerId,
      buyerName: buyer.name,
      crop: lot.crop,
      pricePerKg: body.pricePerKg,
      offeredPricePerKg: body.pricePerKg,
      amount,
      totalAmount: amount,
      quantityKg: quantity,
      validUntil:
        body.validUntil ??
        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      terms: body.terms ?? 'Standard terms apply.',
      buyerVerified: buyer.verificationStatus === 'verified',
      counteredFromId: null,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.offers.insert(record);
    return {success: true, offer: record};
  }

  @Patch('/:id')
  @HttpCode(200)
  async transition(
    @Param('id') id: string,
    @Body() body: UpdateOfferBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    offer: OfferRecord;
    payment?: unknown;
    rejectedSiblings?: number;
  }> {
    const farmerId = resolveFarmerId(farmerHeader);
    if (body.status === 'accepted') {
      const result = await this.offerService.accept(id, farmerId);
      return {
        success: true,
        offer: result.offer,
        payment: result.payment,
        rejectedSiblings: result.rejectedSiblings,
      };
    }
    if (body.status === 'rejected') {
      const offer = await this.offerService.reject(id, farmerId);
      return {success: true, offer};
    }
    if (body.status === 'withdrawn') {
      const offer = await this.offerService.withdraw(id, farmerId);
      return {success: true, offer};
    }
    if (body.status === 'countered') {
      const updated = await this.offerService.transitionCountered(id, farmerId);
      return {success: true, offer: updated};
    }
    throw new BadRequestError(
      `Status "${body.status}" cannot be reached via this endpoint.`,
    );
  }

  @Post('/:id/counter')
  @HttpCode(201)
  async counter(
    @Param('id') id: string,
    @Body() body: CounterOfferBody,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{success: boolean; original: OfferRecord; counter: OfferRecord}> {
    const farmerId = resolveFarmerId(farmerHeader);
    const result = await this.offerService.counterOffer(
      id,
      farmerId,
      body.pricePerKg,
      body.message,
    );
    return {success: true, ...result};
  }
}

/**
 * Nested offers endpoint under `/lots/:lotId/offers`.
 */
@OpenAPI({tags: ['transaction']})
@injectable()
@JsonController('/lots')
export class LotOffersController {
  constructor(
    @inject(GLOBAL_TYPES.TransactionOfferRepository)
    private readonly offers: OfferRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionSeedLoader)
    private readonly seed: SeedLoader,
  ) {}

  @Get('/:lotId/offers')
  @HttpCode(200)
  async listForLot(
    @Param('lotId') lotId: string,
    @HeaderParam(DEMO_HEADER) farmerHeader?: string,
  ): Promise<{
    success: boolean;
    offers: OfferRecord[];
    isDemo: boolean;
    total: number;
  }> {
    await this.seed.ensureSeeded();
    const farmerId = resolveFarmerId(farmerHeader);
    const lot = await this.lots.findById(lotId);
    if (!lot) {
      throw new NotFoundError(`Lot ${lotId} not found`);
    }
    if (lot.farmerId !== farmerId) {
      throw new ForbiddenError('Lot does not belong to this farmer');
    }
    const offers = await this.offers.findByLot(lotId);
    return {
      success: true,
      offers,
      isDemo: offers.length > 0 && offers.every((o) => o.isDemo),
      total: offers.length,
    };
  }
}