/**
 * Farmer Market Intelligence Dashboard — Type Definitions
 *
 * This file contains ALL types used by the new farmer dashboard.
 * It is fully isolated from existing AgriSeva-AI types.
 *
 * IMPLEMENTED vs DEMO vs FUTURE status:
 * - All MarketPrice, Buyer, FarmerLot, Offer, Logistics, Storage, Payment,
 *   Grievance data fields are part of the IMPLEMENTED UI contract.
 * - The data values themselves (prices, buyer names, distances) are DEMO data
 *   loaded from mocks/. The UI clearly labels such data as "Demo Data".
 * - Future features (price-trend forecasting, AI sale-window recommendation,
 *   payment-gateway integration, Aadhaar KYC) are NOT represented here.
 */

export type BuyerType =
  | "FPO"
  | "Processor"
  | "Retailer"
  | "Institutional"
  | "Exporter"
  | "Digital";

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type QualityGrade = "A" | "B" | "C";

export interface MarketPrice {
  id: string;
  commodity: string;
  /** UI alias for `commodity`. */
  crop: string;
  market: string;
  state: string;
  district: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  /** Difference vs prior session, expressed as a percent. */
  changePct: number;
  unit: string;
  arrivalDate: string;
  /** ISO timestamp the price was reported; UI alias for `arrivalDate`. */
  reportedAt?: string;
  source: string;
  distanceKm?: number;
  trendPct?: number;
  // -------- live-backend passthrough fields (all optional) --------
  /** Backend `recordKey`; when present, prefer it over `id` for uniqueness. */
  recordKey?: string;
  /** Human-friendly upstream system name (e.g. "Agmarknet"). */
  sourceSystem?: string;
  /** URL of the upstream MCP/system this record originated from. */
  sourceUrl?: string;
  /** Crop variety (e.g. "Cereals", "Hybrid", or local name). */
  variety?: string;
  /** Quality grade letter or numeric code (Agmarknet / eNAM specific). */
  grade?: string;
  /** Top-level commodity group (e.g. "Cereals", "Pulses"). */
  commodityGroup?: string;
  /** Quantity arrived in the source's native unit (quintals or tonnes). */
  arrivalQty?: number;
}

export interface MarketPriceResponse {
  success: boolean;
  bestMatch: MarketPrice | null;
  alternatives: MarketPrice[];
  totalResults: number;
  errorMessage: string;
  responseDate: string;
  isDemo: boolean;
}

export interface Buyer {
  // Core identity
  id: string;
  /** Display name shown on cards / details ("Sri Lakshmi Foods"). */
  name: string;
  /** Human-friendly buyer type label ("Processor", "FPO", …). */
  type: string;
  businessName: string;
  businessType: BuyerType;
  verificationStatus: VerificationStatus;
  contactPerson: string;
  phone: string;
  email: string;
  /** Display location string ("Krishnagiri, Tamil Nadu"). */
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
  /** Historical deal count surfaced in the buyer card as "X deals". */
  completedDeals: number;
  description: string;
  /** Public-facing website, optional. */
  website?: string;
  /** ISO date string for member-since. */
  memberSince?: string;
  /** Preferred payment method label (e.g. "NEFT / RTGS"). */
  preferredPayment?: string;
  /** Free-text notes shown on buyer detail. */
  notes?: string;
  /** Convenience boolean derived from verificationStatus. */
  verified: boolean;
  isDemo: boolean;
}

export interface FarmerLot {
  id: string;
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
  /** Free-text notes the farmer attached to the lot. */
  notes?: string;
  status: "draft" | "active" | "matched" | "sold" | "expired";
  createdAt: string;
  isDemo: boolean;
}

export interface Offer {
  id: string;
  lotId: string;
  buyerId: string;
  buyerName: string;
  /** Convenience alias carried by the UI; mirrors `Offer.crop`. */
  crop?: string;
  verified: boolean;
  /** Convenience alias the UI uses for the price column. */
  pricePerKg: number;
  offeredPricePerKg: number;
  /** Convenience alias used by the offers list. */
  amount: number;
  totalAmount: number;
  quantityKg: number;
  validUntil: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "expired"
    | "countered";
  terms: string;
  createdAt: string;
  isDemo: boolean;
}

export interface LogisticsOption {
  id: string;
  providerName: string;
  /** UI alias for `providerName`. */
  provider?: string;
  vehicleType: "small_truck" | "medium_truck" | "large_truck" | "tempo";
  capacityTons: number;
  /** UI alias for `capacityTons * 1000`. */
  capacityKg?: number;
  costPerKm: number;
  /** UI alias for `costPerKm`. */
  ratePerKg?: number;
  estimatedCost: number;
  estimatedHours: number;
  /** UI alias for `estimatedHours * 24` (rough delivery date offset). */
  estimatedDeliveryDate?: string;
  distanceKm: number;
  fromLocation: string;
  /** UI alias for `fromLocation`. */
  from?: string;
  toLocation: string;
  /** UI alias for `toLocation`. */
  to?: string;
  /** Whether the shipment is insured. Demo only; defaults to false. */
  insured?: boolean;
  isDemo: boolean;
}

export interface StorageOption {
  id: string;
  facilityName: string;
  facilityType: "warehouse" | "cold_storage" | "silo";
  capacityTons: number;
  availableTons: number;
  state: string;
  district: string;
  costPerQuintalPerDay: number;
  distanceKm: number;
  isDemo: boolean;
}

/**
 * Shape consumed by the StoragePage UI. Built from `StorageOption` data
 * via `useStorage()` so the UI renders the same component shape whether
 * the source is the heavy mock or a future live API.
 */
export interface StorageView {
  id: string;
  /** Display name shown in the card. */
  name: string;
  /** "warehouse" | "cold" — matches UI expectations. */
  type: "warehouse" | "cold";
  /** Human-readable location label. */
  location: string;
  /** Cold-storage temperature in °C; null when not cold storage. */
  temperatureC: number | null;
  /** Total capacity in kilograms (UI derives occupancy from usedKg). */
  capacityKg: number;
  /** Currently occupied kilograms. */
  usedKg: number;
  isDemo: boolean;
}

export type PaymentStatus =
  | "initiated"
  | "pending"
  | "partial"
  | "completed"
  | "failed"
  | "disputed"
  | "paid";

export interface PaymentRecord {
  id: string;
  lotId: string;
  buyerName: string;
  crop: string;
  quantityKg: number;
  amount: number;
  status: PaymentStatus;
  reference: string;
  createdAt: string;
  completedAt: string | null;
  /** Short summary shown under buyer name ("Chilli • 200kg"). */
  lotSummary: string;
  /** Payment instrument label ("NEFT", "UPI", "Cash", etc.). */
  method: string;
  timeline: PaymentTimelineEvent[];
  isDemo: boolean;
}

export interface PaymentTimelineEvent {
  label: string;
  status: "done" | "current" | "upcoming";
  timestamp: string | null;
  /** Alias of timestamp kept for UI ergonomics (timeline renders "at"). */
  at: string | null;
}

export type GrievanceCategory =
  | "payment"
  | "quality"
  | "logistics"
  | "buyer"
  | "other"
  | "weight"
  | "transport";

export type GrievanceStatus = "open" | "in_review" | "resolved" | "rejected";
export type GrievancePriority = "low" | "medium" | "high";

export interface Grievance {
  id: string;
  raisedBy: string;
  category: GrievanceCategory;
  /** One-line headline shown in the list view. */
  subject: string;
  /** Free-text description shown in the detail view. */
  description: string;
  priority: GrievancePriority;
  /** Either a payment reference or a logistics reference. */
  transactionRef: string;
  status: GrievanceStatus;
  assignedTo: string;
  resolutionNotes: string;
  /** Alias of submittedAt for UI ergonomics. */
  createdAt: string;
  submittedAt: string;
  resolvedAt: string | null;
  isDemo: boolean;
}

export interface FarmerProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  district: string;
  village: string;
  preferredLanguage: string;
  primaryCrops: string[];
  preferredMarkets: string[];
  fpoName: string;
  fpoMember: boolean;
  landSizeAcres: number;
  /** Years of farming experience (UI-facing; persisted in farmerProfile). */
  experienceYears?: number;
  joinedAt: string;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
}

export type Commodity =
  | "Tomato"
  | "Onion"
  | "Potato"
  | "Rice"
  | "Wheat"
  | "Maize"
  | "Cotton"
  | "Sugarcane"
  | "Groundnut"
  | "Soybean"
  | "Turmeric"
  | "Chilli"
  | "Coriander"
  | "Cumin"
  | "Black Gram"
  | "Green Gram"
  | "Pigeon Pea"
  | "Mustard";

export const COMMODITIES: Commodity[] = [
  "Tomato",
  "Onion",
  "Potato",
  "Rice",
  "Wheat",
  "Maize",
  "Cotton",
  "Sugarcane",
  "Groundnut",
  "Soybean",
  "Turmeric",
  "Chilli",
  "Coriander",
  "Cumin",
  "Black Gram",
  "Green Gram",
  "Pigeon Pea",
  "Mustard",
];

export const INDIAN_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export interface TodayInsight {
  commodity: string;
  /** UI alias for `commodity`. */
  crop: string;
  modalPrice: number;
  unit: string;
  trendPct: number;
  /** UI alias for `trendPct`. */
  changePct: number;
  trendDirection: "up" | "down" | "flat";
  recommendation: string;
  strongestMarket: string;
  /** UI alias for `strongestMarket`. */
  market: string;
  weakestMarket: string;
  distanceKm: number;
  isDemo: boolean;
}

export interface MarketPriceFilters {
  state: string;
  district: string;
  commodity: string;
  /** UI alias for `commodity`. */
  crop?: string;
  arrivalDate?: string;
}

/**
 * Market Insight — additive interface used by the new Market Intelligence
 * decision-support surfaces (Home "Best Market" card, Market Comparison
 * page, Lot Detail "Best markets for this lot" card).
 *
 * Bundles everything the UI needs to render a single recommendation row
 * without re-deriving from the underlying mandi prices, buyers and
 * logistics at render time.
 *
 * The pure functions in `market-intelligence/` produce this shape via
 * `recommendBestMarketForLot(...)`.
 */
export interface MarketInsight {
  /** Stable id (e.g. market-price id). */
  id: string;
  /** Crop / commodity being recommended. */
  crop: string;
  /** Mandi name. */
  marketName: string;
  /** State of the mandi. */
  marketState: string;
  /** District of the mandi. */
  marketDistrict: string;
  /** Distance from farmer's village to this mandi in km. */
  distanceKm: number;
  /** Modal mandi price in ₹/quintal. */
  modalPricePerQuintal: number;
  /** Effective price in ₹/kg. */
  pricePerKg: number;
  /** Net realisable value in ₹ (after all deductions). */
  netRealisable: number;
  /** Net per kg in ₹. */
  netPerKg: number;
  /** 0..100 weighted score. */
  score: number;
  /** Optional preferred buyer for this mandi. */
  preferredBuyerId: string | null;
  preferredBuyerName: string | null;
  preferredBuyerReliability: number | null;
  /** Top reasons (already ordered by impact). */
  reasons: string[];
  /** Provenance — always "Demo" in this build. */
  source: string;
  isDemo: boolean;
}


