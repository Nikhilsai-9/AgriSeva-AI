/**
 * class-validator DTOs for the transaction module.
 *
 * Keep these tight: every validator that hits a Mongo collection has
 * already been audited for safety; we do NOT want free-form bodies
 * flowing through to repositories.
 */

import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  LotStatus,
  OfferStatus,
  PaymentStatus,
  GrievanceStatus,
  GrievancePriority,
  GrievanceCategory,
  VerificationStatus,
} from '../types.js';

class BuyerListQuery {
  @JSONSchema({description: 'Filter by verification status'})
  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  verificationStatus?: VerificationStatus;

  @JSONSchema({description: 'Filter by state'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'Filter by commodity'})
  @IsOptional()
  @IsString()
  commodity?: string;

  @JSONSchema({description: 'Filter by business type'})
  @IsOptional()
  @IsString()
  businessType?: string;

  @JSONSchema({description: 'Filter by crop interest'})
  @IsOptional()
  @IsString()
  crop?: string;
}

class BuyerIdParam {
  @JSONSchema({description: 'Buyer id'})
  @IsString()
  id!: string;
}

class BuyerVerificationBody {
  @JSONSchema({description: 'New verification status'})
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  verificationStatus!: VerificationStatus;
}

class LotListQuery {
  @JSONSchema({description: 'Filter by lot status'})
  @IsOptional()
  @IsIn(['draft', 'active', 'matched', 'sold', 'expired'])
  status?: LotStatus;

  @JSONSchema({description: 'Restrict to a specific farmer id'})
  @IsOptional()
  @IsString()
  farmerId?: string;

  @JSONSchema({description: 'Filter by crop / commodity'})
  @IsOptional()
  @IsString()
  crop?: string;
}

class LotIdParam {
  @JSONSchema({description: 'Lot id'})
  @IsString()
  id!: string;
}

class LotIdInPathParam {
  @JSONSchema({description: 'Lot id in URL path'})
  @IsString()
  lotId!: string;
}

class CreateLotBody {
  @JSONSchema({description: 'Crop name', example: 'Tomato'})
  @IsString()
  crop!: string;

  @JSONSchema({description: 'Variety (optional)'})
  @IsOptional()
  @IsString()
  variety?: string;

  @JSONSchema({description: 'Quantity in kg'})
  @IsNumber()
  @Min(1)
  quantityKg!: number;

  @JSONSchema({description: 'Quality grade', example: 'A'})
  @IsIn(['A', 'B', 'C'])
  qualityGrade!: 'A' | 'B' | 'C';

  @JSONSchema({description: 'Quality notes'})
  @IsOptional()
  @IsString()
  qualityNotes?: string;

  @JSONSchema({description: 'Expected price per kg in INR'})
  @IsNumber()
  @Min(0)
  expectedPricePerKg!: number;

  @JSONSchema({description: 'State', example: 'Karnataka'})
  @IsString()
  state!: string;

  @JSONSchema({description: 'District', example: 'Kolar'})
  @IsString()
  district!: string;

  @JSONSchema({description: 'Village (optional)'})
  @IsOptional()
  @IsString()
  village?: string;

  @JSONSchema({description: 'Harvest date YYYY-MM-DD'})
  @IsDateString()
  harvestDate!: string;

  @JSONSchema({description: 'Image URLs (optional)'})
  @IsOptional()
  @IsArray()
  @IsString({each: true})
  images?: string[];

  @JSONSchema({description: 'Free-text notes'})
  @IsOptional()
  @IsString()
  notes?: string;

  @JSONSchema({description: 'Initial lot status (default: active)'})
  @IsOptional()
  @IsIn(['draft', 'active', 'matched', 'sold', 'expired'])
  status?: LotStatus;
}

class UpdateLotBody {
  @JSONSchema({description: 'Crop'})
  @IsOptional()
  @IsString()
  crop?: string;

  @JSONSchema({description: 'Variety'})
  @IsOptional()
  @IsString()
  variety?: string;

  @JSONSchema({description: 'Quantity in kg'})
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantityKg?: number;

  @JSONSchema({description: 'Quality grade'})
  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  qualityGrade?: 'A' | 'B' | 'C';

  @JSONSchema({description: 'Quality notes'})
  @IsOptional()
  @IsString()
  qualityNotes?: string;

  @JSONSchema({description: 'Expected price per kg'})
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedPricePerKg?: number;

  @JSONSchema({description: 'State'})
  @IsOptional()
  @IsString()
  state?: string;

  @JSONSchema({description: 'District'})
  @IsOptional()
  @IsString()
  district?: string;

  @JSONSchema({description: 'Village'})
  @IsOptional()
  @IsString()
  village?: string;

  @JSONSchema({description: 'Harvest date'})
  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @JSONSchema({description: 'Notes'})
  @IsOptional()
  @IsString()
  notes?: string;

  @JSONSchema({description: 'Status'})
  @IsOptional()
  @IsIn(['draft', 'active', 'matched', 'sold', 'expired'])
  status?: LotStatus;

  @JSONSchema({description: 'Images array'})
  @IsOptional()
  @IsArray()
  @IsString({each: true})
  images?: string[];
}

class MarkLotSoldBody {
  @JSONSchema({description: 'Final sale price per kg in INR'})
  @IsNumber()
  @Min(0)
  finalPricePerKg!: number;

  @JSONSchema({description: 'Buyer name (free-text for offline sales)'})
  @IsString()
  buyerName!: string;

  @JSONSchema({description: 'Optional winning offer id'})
  @IsOptional()
  @IsString()
  winningOfferId?: string;
}

class OfferListQuery {
  @JSONSchema({description: 'Filter by offer status'})
  @IsOptional()
  @IsIn(['pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'countered'])
  status?: OfferStatus;

  @JSONSchema({description: 'Restrict to a specific lot id'})
  @IsOptional()
  @IsString()
  lotId?: string;
}

class OfferIdParam {
  @JSONSchema({description: 'Offer id'})
  @IsString()
  id!: string;
}

class CreateOfferBody {
  @JSONSchema({description: 'Lot id'})
  @IsString()
  lotId!: string;

  @JSONSchema({description: 'Buyer id'})
  @IsString()
  buyerId!: string;

  @JSONSchema({description: 'Offer price per kg'})
  @IsNumber()
  @Min(0)
  pricePerKg!: number;

  @JSONSchema({description: 'Quantity kg (defaults to lot quantity if omitted)'})
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantityKg?: number;

  @JSONSchema({description: 'ISO datetime when offer expires'})
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @JSONSchema({description: 'Terms text'})
  @IsOptional()
  @IsString()
  terms?: string;
}

class UpdateOfferBody {
  @JSONSchema({description: 'New status'})
  @IsIn(['pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'countered'])
  status!: OfferStatus;
}

class CounterOfferBody {
  @JSONSchema({description: 'Counter price per kg'})
  @IsNumber()
  @Min(0)
  pricePerKg!: number;

  @JSONSchema({description: 'Counter message / terms'})
  @IsOptional()
  @IsString()
  message?: string;
}

class PaymentListQuery {
  @JSONSchema({description: 'Filter by payment status'})
  @IsOptional()
  @IsIn(['initiated', 'pending', 'partial', 'completed', 'failed', 'disputed', 'paid'])
  status?: PaymentStatus;

  @JSONSchema({description: 'Restrict to a lot id'})
  @IsOptional()
  @IsString()
  lotId?: string;
}

class PaymentIdParam {
  @JSONSchema({description: 'Payment id'})
  @IsString()
  id!: string;
}

class CreatePaymentBody {
  @JSONSchema({description: 'Lot id'})
  @IsString()
  lotId!: string;

  @JSONSchema({description: 'Buyer name'})
  @IsString()
  buyerName!: string;

  @JSONSchema({description: 'Crop'})
  @IsString()
  crop!: string;

  @JSONSchema({description: 'Quantity in kg'})
  @IsNumber()
  @Min(1)
  quantityKg!: number;

  @JSONSchema({description: 'Payment amount INR'})
  @IsNumber()
  @Min(0)
  amount!: number;

  @JSONSchema({description: 'Method label'})
  @IsOptional()
  @IsString()
  method?: string;

  @JSONSchema({description: 'Reference number'})
  @IsOptional()
  @IsString()
  reference?: string;

  @JSONSchema({description: 'Status'})
  @IsOptional()
  @IsIn(['initiated', 'pending', 'partial', 'completed', 'failed', 'disputed', 'paid'])
  status?: PaymentStatus;
}

class UpdatePaymentBody {
  @JSONSchema({description: 'Payment status'})
  @IsOptional()
  @IsIn(['initiated', 'pending', 'partial', 'completed', 'failed', 'disputed', 'paid'])
  status?: PaymentStatus;

  @JSONSchema({description: 'Method label'})
  @IsOptional()
  @IsString()
  method?: string;

  @JSONSchema({description: 'Reference number'})
  @IsOptional()
  @IsString()
  reference?: string;

  @JSONSchema({description: 'Completed timestamp ISO'})
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

class GrievanceListQuery {
  @JSONSchema({description: 'Filter by status'})
  @IsOptional()
  @IsIn(['open', 'in_review', 'resolved', 'rejected'])
  status?: GrievanceStatus;

  @JSONSchema({description: 'Filter by category'})
  @IsOptional()
  @IsIn(['payment', 'quality', 'logistics', 'buyer', 'other', 'weight', 'transport'])
  category?: GrievanceCategory;

  @JSONSchema({description: 'Filter by lot id'})
  @IsOptional()
  @IsString()
  lotId?: string;
}

class GrievanceIdParam {
  @JSONSchema({description: 'Grievance id'})
  @IsString()
  id!: string;
}

class CreateGrievanceBody {
  @JSONSchema({description: 'Grievance category'})
  @IsIn(['payment', 'quality', 'logistics', 'buyer', 'other', 'weight', 'transport'])
  category!: GrievanceCategory;

  @JSONSchema({description: 'Subject'})
  @IsString()
  subject!: string;

  @JSONSchema({description: 'Description'})
  @IsString()
  description!: string;

  @JSONSchema({description: 'Priority'})
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: GrievancePriority;

  @JSONSchema({description: 'Optional lot id'})
  @IsOptional()
  @IsString()
  lotId?: string;

  @JSONSchema({description: 'Optional offer id'})
  @IsOptional()
  @IsString()
  offerId?: string;

  @JSONSchema({description: 'Optional transaction reference (eg: payment/lottery id)'})
  @IsOptional()
  @IsString()
  transactionRef?: string;

  @JSONSchema({description: 'Raised by (defaults to farmer display name)'})
  @IsOptional()
  @IsString()
  raisedBy?: string;
}

class UpdateGrievanceBody {
  @JSONSchema({description: 'Status'})
  @IsOptional()
  @IsIn(['open', 'in_review', 'resolved', 'rejected'])
  status?: GrievanceStatus;

  @JSONSchema({description: 'Priority'})
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: GrievancePriority;

  @JSONSchema({description: 'Resolution notes'})
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @JSONSchema({description: 'Assigned team / officer'})
  @IsOptional()
  @IsString()
  assignedTo?: string;
}

class StorageBookingBody {
  @JSONSchema({description: 'Storage option id'})
  @IsString()
  storageId!: string;

  @JSONSchema({description: 'Storage facility display name'})
  @IsString()
  storageName!: string;

  @JSONSchema({description: 'UI storage type tag'})
  @IsIn(['warehouse', 'cold', 'silo'])
  storageType!: 'warehouse' | 'cold' | 'silo';

  @JSONSchema({description: 'Reserved kg'})
  @IsNumber()
  @Min(1)
  reservedKg!: number;

  @JSONSchema({description: 'Reservation duration in days'})
  @IsInt()
  @Min(1)
  durationDays!: number;

  @JSONSchema({description: 'Expected arrival ISO date'})
  @IsOptional()
  @IsDateString()
  expectedArrival?: string;

  @JSONSchema({description: 'Optional lot id'})
  @IsOptional()
  @IsString()
  lotId?: string | null;

  @JSONSchema({description: 'Human-readable lot summary'})
  @IsString()
  lotSummary!: string;
}

class LogisticsBookingBody {
  @JSONSchema({description: 'Logistics option id'})
  @IsString()
  logisticsId!: string;

  @JSONSchema({description: 'Provider name (mirrored from option)'})
  @IsOptional()
  @IsString()
  providerName?: string;

  @JSONSchema({description: 'Vehicle type (mirrored)'})
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @JSONSchema({description: 'Distance km (mirrored)'})
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @JSONSchema({description: 'Estimated cost (mirrored)'})
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @JSONSchema({description: 'Expected arrival ISO date'})
  @IsOptional()
  @IsDateString()
  expectedArrival?: string;

  @JSONSchema({description: 'Optional lot id'})
  @IsOptional()
  @IsString()
  lotId?: string | null;

  @JSONSchema({description: 'Human-readable lot summary'})
  @IsString()
  lotSummary!: string;
}

export {
  BuyerListQuery,
  BuyerIdParam,
  BuyerVerificationBody,
  LotListQuery,
  LotIdParam,
  LotIdInPathParam,
  CreateLotBody,
  UpdateLotBody,
  MarkLotSoldBody,
  OfferListQuery,
  OfferIdParam,
  CreateOfferBody,
  UpdateOfferBody,
  CounterOfferBody,
  PaymentListQuery,
  PaymentIdParam,
  CreatePaymentBody,
  UpdatePaymentBody,
  GrievanceListQuery,
  GrievanceIdParam,
  CreateGrievanceBody,
  UpdateGrievanceBody,
  StorageBookingBody,
  LogisticsBookingBody,
};

export const TRANSACTION_VALIDATORS = [
  BuyerListQuery,
  BuyerIdParam,
  BuyerVerificationBody,
  LotListQuery,
  LotIdParam,
  LotIdInPathParam,
  CreateLotBody,
  UpdateLotBody,
  MarkLotSoldBody,
  OfferListQuery,
  OfferIdParam,
  CreateOfferBody,
  UpdateOfferBody,
  CounterOfferBody,
  PaymentListQuery,
  PaymentIdParam,
  CreatePaymentBody,
  UpdatePaymentBody,
  GrievanceListQuery,
  GrievanceIdParam,
  CreateGrievanceBody,
  UpdateGrievanceBody,
  StorageBookingBody,
  LogisticsBookingBody,
];
