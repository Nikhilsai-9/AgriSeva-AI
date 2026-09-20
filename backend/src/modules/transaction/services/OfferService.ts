/**
 * OfferService - orchestrates the multi-collection cascade triggered
 * by an offer being accepted or countered.
 *
 * Accept cascade:
 *   1. transition target offer pending|countered -> accepted
 *   2. verify lot ownership (farmerId match)
 *   3. atomically reject sibling offers on the same lot
 *   4. update lot status -> sold
 *   5. materialize payment record (only when none exists yet)
 */

import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {OfferRepository} from '../repositories/OfferRepository.js';
import {LotRepository} from '../repositories/LotRepository.js';
import {PaymentRepository} from '../repositories/PaymentRepository.js';
import type {OfferRecord, PaymentRecordDoc} from '../types.js';

export interface AcceptOfferResult {
  offer: OfferRecord;
  rejectedSiblings: number;
  payment: PaymentRecordDoc;
}

export interface CounterOfferResult {
  original: OfferRecord;
  counter: OfferRecord;
}

@injectable()
export class OfferService {
  constructor(
    @inject(GLOBAL_TYPES.TransactionOfferRepository)
    private readonly offers: OfferRepository,
    @inject(GLOBAL_TYPES.TransactionLotRepository)
    private readonly lots: LotRepository,
    @inject(GLOBAL_TYPES.TransactionPaymentRepository)
    private readonly payments: PaymentRepository,
  ) {}

  public async accept(
    offerId: string,
    farmerId: string,
  ): Promise<AcceptOfferResult> {
    const updated = await this.offers.transition(
      offerId,
      ['pending', 'countered'],
      'accepted',
    );
    if (!updated) {
      throw new Error(
        `Offer ${offerId} not found or not in an acceptable state`,
      );
    }
    const lot = await this.lots.findByIdForFarmer(updated.lotId, farmerId);
    if (!lot) {
      await this.offers.transition(offerId, ['accepted'], 'pending');
      throw new Error('Lot does not belong to the authenticated farmer');
    }
    const rejected = await this.offers.rejectSiblings(updated.lotId, offerId);
    await this.lots.updateStatus(updated.lotId, 'sold', farmerId);
    let payment = await this.payments.findActiveByLot(updated.lotId);
    if (!payment) {
      payment = await this.materializePayment(updated, lot.createdAt, farmerId);
    }
    return {offer: updated, rejectedSiblings: rejected, payment};
  }

  public async reject(
    offerId: string,
    farmerId: string,
  ): Promise<OfferRecord> {
    const existing = await this.offers.findById(offerId);
    if (!existing) {
      throw new Error(`Offer ${offerId} not found`);
    }
    const lot = await this.lots.findByIdForFarmer(existing.lotId, farmerId);
    if (!lot) {
      throw new Error('Lot does not belong to the authenticated farmer');
    }
    const updated = await this.offers.transition(
      offerId,
      ['pending', 'countered'],
      'rejected',
    );
    if (!updated) {
      throw new Error(`Offer ${offerId} cannot be rejected from current state`);
    }
    return updated;
  }

  public async withdraw(
    offerId: string,
    farmerId: string,
  ): Promise<OfferRecord> {
    const existing = await this.offers.findById(offerId);
    if (!existing) {
      throw new Error(`Offer ${offerId} not found`);
    }
    const lot = await this.lots.findByIdForFarmer(existing.lotId, farmerId);
    if (!lot) {
      throw new Error('Lot does not belong to the authenticated farmer');
    }
    const updated = await this.offers.transition(
      offerId,
      ['pending', 'countered'],
      'withdrawn',
    );
    if (!updated) {
      throw new Error(`Offer ${offerId} cannot be withdrawn from current state`);
    }
    return updated;
  }

  public async transitionCountered(
    offerId: string,
    farmerId: string,
  ): Promise<OfferRecord> {
    const existing = await this.offers.findById(offerId);
    if (!existing) {
      throw new Error(`Offer ${offerId} not found`);
    }
    const lot = await this.lots.findByIdForFarmer(existing.lotId, farmerId);
    if (!lot) {
      throw new Error('Lot does not belong to the authenticated farmer');
    }
    const updated = await this.offers.transition(
      offerId,
      ['pending'],
      'countered',
    );
    if (!updated) {
      throw new Error(`Offer ${offerId} cannot be marked countered`);
    }
    return updated;
  }

  public async counterOffer(
    offerId: string,
    farmerId: string,
    newPricePerKg: number,
    message: string | undefined,
  ): Promise<CounterOfferResult> {
    const original = await this.offers.findById(offerId);
    if (!original) {
      throw new Error(`Offer ${offerId} not found`);
    }
    const lot = await this.lots.findByIdForFarmer(original.lotId, farmerId);
    if (!lot) {
      throw new Error('Lot does not belong to the authenticated farmer');
    }
    const flipped = await this.offers.transition(
      offerId,
      ['pending', 'countered'],
      'countered',
    );
    if (!flipped) {
      throw new Error(`Offer ${offerId} cannot be countered from current state`);
    }
    const now = new Date().toISOString();
    const counter: OfferRecord = {
      id: `offer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      lotId: original.lotId,
      buyerId: original.buyerId,
      buyerName: original.buyerName,
      crop: original.crop,
      pricePerKg: newPricePerKg,
      offeredPricePerKg: newPricePerKg,
      amount: newPricePerKg * original.quantityKg,
      totalAmount: newPricePerKg * original.quantityKg,
      quantityKg: original.quantityKg,
      validUntil: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: 'pending',
      terms: message ?? 'Countered by farmer',
      buyerVerified: original.buyerVerified,
      counteredFromId: original.id,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.offers.insert(counter);
    return {original: flipped, counter};
  }

  private async materializePayment(
    offer: OfferRecord,
    lotCreatedAt: string,
    farmerId: string,
  ): Promise<PaymentRecordDoc> {
    const now = new Date().toISOString();
    const payment: PaymentRecordDoc = {
      id: `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      lotId: offer.lotId,
      buyerId: offer.buyerId,
      buyerName: offer.buyerName,
      crop: offer.crop,
      quantityKg: offer.quantityKg,
      amount: offer.amount,
      status: 'pending',
      reference: `PAY-${Date.now().toString(36).toUpperCase()}`,
      method: 'NEFT',
      lotSummary: `${offer.crop} - ${offer.quantityKg}kg`,
      timeline: [
        {label: 'Lot Created', status: 'done', timestamp: lotCreatedAt},
        {label: 'Buyer Offer', status: 'done', timestamp: offer.createdAt},
        {label: 'Offer Accepted', status: 'done', timestamp: now},
        {label: 'Delivered', status: 'current', timestamp: null},
        {label: 'Payment Processing', status: 'upcoming', timestamp: null},
        {label: 'Payment Received', status: 'upcoming', timestamp: null},
      ],
      farmerId,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    await this.payments.insert(payment);
    return payment;
  }
}