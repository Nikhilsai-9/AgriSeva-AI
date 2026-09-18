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
  market: string;
  state: string;
  district: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: string;
  arrivalDate: string;
  source: string;
  distanceKm?: number;
  trendPct?: number;
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
  id: string;
  businessName: string;
  businessType: BuyerType;
  verificationStatus: VerificationStatus;
  contactPerson: string;
  phone: string;
  email: string;
  state: string;
  district: string;
  distanceKm: number;
  cropsInterested: string[];
  minQuantityKg: number;
  maxQuantityKg: number;
  paymentTermsDays: number;
  rating: number;
  transactionsCount: number;
  description: string;
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
  status: "draft" | "active" | "matched" | "sold" | "expired";
  createdAt: string;
  isDemo: boolean;
}

export interface Offer {
  id: string;
  lotId: string;
  buyerId: string;
  buyerName: string;
  verified: boolean;
  offeredPricePerKg: number;
  totalAmount: number;
  quantityKg: number;
  validUntil: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "expired";
  terms: string;
  createdAt: string;
  isDemo: boolean;
}

export interface LogisticsOption {
  id: string;
  providerName: string;
  vehicleType: "small_truck" | "medium_truck" | "large_truck" | "tempo";
  capacityTons: number;
  costPerKm: number;
  estimatedCost: number;
  estimatedHours: number;
  distanceKm: number;
  fromLocation: string;
  toLocation: string;
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

export type PaymentStatus =
  | "initiated"
  | "pending"
  | "partial"
  | "completed"
  | "failed"
  | "disputed";

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
  timeline: PaymentTimelineEvent[];
  isDemo: boolean;
}

export interface PaymentTimelineEvent {
  label: string;
  status: "done" | "current" | "upcoming";
  timestamp: string | null;
}

export type GrievanceCategory =
  | "payment"
  | "quality"
  | "logistics"
  | "buyer"
  | "other";

export type GrievanceStatus = "open" | "in_review" | "resolved" | "rejected";

export interface Grievance {
  id: string;
  raisedBy: string;
  category: GrievanceCategory;
  description: string;
  transactionRef: string;
  status: GrievanceStatus;
  assignedTo: string;
  resolutionNotes: string;
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
  modalPrice: number;
  unit: string;
  trendPct: number;
  trendDirection: "up" | "down" | "flat";
  recommendation: string;
  strongestMarket: string;
  weakestMarket: string;
  distanceKm: number;
  isDemo: boolean;
}

export interface MarketPriceFilters {
  state: string;
  district: string;
  commodity: string;
  arrivalDate?: string;
}


