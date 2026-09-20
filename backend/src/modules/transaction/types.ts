/**
 * Transaction module — shared types & interfaces.
 *
 * Persistence-only shapes for buyers, lots, offers, payments, grievances,
 * storage bookings and logistics bookings. These mirror the frontend
 * types in `frontend/src/features/farmerDashboard/types.ts` but use
 * MongoDB-native field conventions (we keep camelCase for stability with
 * the existing UI).
 *
 * IMPORTANT: All demo seeds and demo-only flags are kept in the same
 * document so the API never has to fabricate a "demo" wrapper envelope.
 * The `isDemo` boolean is set to true by the seed loader and false by
 * any user-driven create/update path.
 */

export type BuyerType =
  | 'FPO'
  | 'Processor'
  | 'Retailer'
  | 'Institutional'
  | 'Exporter'
  | 'Digital';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';

export type QualityGrade = 'A' | 'B' | 'C';

export type LotStatus = 'draft' | 'active' | 'matched' | 'sold' | 'expired';

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  | 'countered';

export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'partial'
  | 'completed'
  | 'failed'
  | 'disputed'
  | 'paid';

export type GrievanceCategory =
  | 'payment'
  | 'quality'
  | 'logistics'
  | 'buyer'
  | 'other'
  | 'weight'
  | 'transport';

export type GrievanceStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
export type GrievancePriority = 'low' | 'medium' | 'high';

export type StorageFacilityType = 'warehouse' | 'cold_storage' | 'silo' | 'cold';

export type StorageBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'reserved';

export type LogisticsVehicleType =
  | 'small_truck'
  | 'medium_truck'
  | 'large_truck'
  | 'tempo';

export type LogisticsBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface BuyerRecord {
  id: string;
  name: string;
  type: string;
  businessName: string;
  businessType: BuyerType;
  verificationStatus: VerificationStatus;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  state: string;
  district: string;
  distanceKm: number;
  cropsInterested: string[];
  minQuantityKg: number;
  maxQuantityKg: number;
  paymentTermsDays: number;
  rating: number;
  transactionsCount: number;
  completedDeals: number;
  description: string;
  website?: string;
  memberSince?: string;
  preferredPayment?: string;
  notes?: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LotRecord {
  id: string;
  /** Farmer id of the lot owner. */
  farmerId: string;
  crop: string;
  variety: string;
  quantityKg: number;
  qualityGrade: QualityGrade;
  qualityNotes: string;
  expectedPricePerKg: number;
  state: string;
  district: string;
  village: string;
  harvestDate: string;
  images: string[];
  notes?: string;
  status: LotStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  id: string;
  lotId: string;
  buyerId: string;
  buyerName: string;
  crop: string;
  pricePerKg: number;
  offeredPricePerKg: number;
  amount: number;
  totalAmount: number;
  quantityKg: number;
  validUntil: string;
  status: OfferStatus;
  terms: string;
  /** Buyer-verification flag mirrored from the buyer at offer creation time. */
  buyerVerified: boolean;
  /**
   * Set when this offer is a counter — points back to the offer being countered.
   * Null for fresh offers.
   */
  counteredFromId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTimelineEvent {
  label: string;
  status: 'done' | 'current' | 'upcoming';
  timestamp: string | null;
}

export interface PaymentRecordDoc {
  id: string;
  lotId: string;
  buyerId?: string;
  buyerName: string;
  crop: string;
  quantityKg: number;
  amount: number;
  status: PaymentStatus;
  reference: string;
  method: string;
  lotSummary: string;
  timeline: PaymentTimelineEvent[];
  farmerId: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface GrievanceRecord {
  id: string;
  farmerId: string;
  raisedBy: string;
  category: GrievanceCategory;
  subject: string;
  description: string;
  priority: GrievancePriority;
  transactionRef: string | null;
  lotId: string | null;
  status: GrievanceStatus;
  assignedTo: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  resolvedAt: string | null;
  isDemo: boolean;
}

export interface StorageOptionRecord {
  id: string;
  facilityName: string;
  facilityType: StorageFacilityType;
  capacityTons: number;
  availableTons: number;
  state: string;
  district: string;
  costPerQuintalPerDay: number;
  distanceKm: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageBookingRecord {
  id: string;
  storageId: string;
  storageName: string;
  storageType: StorageFacilityType;
  facilityType: StorageFacilityType;
  state: string;
  district: string;
  reservedKg: number;
  durationDays: number;
  expectedArrival: string | null;
  endDate: string | null;
  totalCost: number;
  costPerQuintalPerDay?: number;
  distanceKm?: number;
  lotId: string | null;
  lotSummary: string;
  farmerId: string;
  status: StorageBookingStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsOptionRecord {
  id: string;
  providerName: string;
  vehicleType: LogisticsVehicleType;
  capacityTons: number;
  costPerKm: number;
  estimatedCost: number;
  estimatedHours: number;
  distanceKm: number;
  fromLocation: string;
  toLocation: string;
  insured: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsBookingRecord {
  id: string;
  logisticsId: string;
  providerName: string;
  vehicleType: LogisticsVehicleType;
  capacityTons: number;
  estimatedHours: number;
  costPerKm: number;
  distanceKm: number;
  estimatedCost: number;
  insured: boolean;
  fromLocation: string;
  toLocation: string;
  lotId: string | null;
  lotSummary: string;
  farmerId: string;
  status: LogisticsBookingStatus;
  expectedArrival: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}
