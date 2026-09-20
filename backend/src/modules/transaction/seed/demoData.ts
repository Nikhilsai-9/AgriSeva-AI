/**
 * Demo seed data for the transaction module.
 *
 * Derived directly from the existing frontend mocks in
 * `frontend/src/features/farmerDashboard/mocks/*` so the demonstration
 * experience is preserved 1:1 once the backend becomes the source of
 * truth.
 *
 * Deterministic IDs (`b1`, `lot-1`, ...) keep bookmarked URLs stable.
 * Every record carries `isDemo: true` so downstream consumers can
 * render a "Demo Data" badge in the UI.
 */

import type {
  BuyerRecord,
  LotRecord,
  OfferRecord,
  PaymentRecordDoc,
  GrievanceRecord,
  StorageOptionRecord,
  LogisticsOptionRecord,
} from '../types.js';

const isoMinusYears = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
};

const isoMinus = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const futureIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const DEMO_FARMER_UID_SEED = 'demo-farmer-uid';
const today = new Date().toISOString().slice(0, 10);

const buyer = (
  id: string,
  name: string,
  businessType: BuyerRecord['businessType'],
  contactPerson: string,
  state: string,
  district: string,
  distanceKm: number,
  crops: string[],
  minKg: number,
  maxKg: number,
  paymentTermsDays: number,
  rating: number,
  deals: number,
  description: string,
  verificationStatus: BuyerRecord['verificationStatus'] = 'verified',
  memberYears = 3,
  preferredPayment = 'NEFT / RTGS',
  phone = '+91 98000 00000',
): BuyerRecord => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    id,
    name,
    type: businessType,
    businessName: name,
    businessType,
    verificationStatus,
    contactPerson,
    phone,
    email: `${slug}@demo.example`,
    location: `${district}, ${state}`,
    state,
    district,
    distanceKm,
    cropsInterested: crops,
    minQuantityKg: minKg,
    maxQuantityKg: maxKg,
    paymentTermsDays,
    rating,
    transactionsCount: deals,
    completedDeals: deals,
    description,
    website: `https://${slug}.demo.example`,
    memberSince: isoMinusYears(memberYears),
    preferredPayment,
    notes: description,
    isDemo: true,
    createdAt: isoMinus(memberYears * 365),
    updatedAt: new Date().toISOString(),
  };
};

export const DEMO_BUYERS: BuyerRecord[] = [
  buyer('b1', 'Sri Lakshmi Foods', 'Processor', 'M. Reddy', 'Tamil Nadu', 'Krishnagiri', 45, ['Tomato', 'Onion', 'Potato'], 2000, 5000, 3, 4.6, 142, 'Tomato ketchup, puree and sauce processing. Daily offload at factory.'),
  buyer('b2', 'Krishna Valley FPO', 'FPO', 'R. Rao', 'Andhra Pradesh', 'Krishna', 28, ['Rice', 'Maize', 'Black Gram'], 5000, 50000, 7, 4.4, 89, 'Farmer Producer Organisation - collective sales and procurement.'),
  buyer('b3', 'Annapurna Retail Chains', 'Retailer', 'P. Sharma', 'Karnataka', 'Bangalore Urban', 38, ['Tomato', 'Onion', 'Potato', 'Chilli'], 500, 3000, 5, 4.2, 234, 'Retail chain - 84 stores across South India.'),
  buyer('b4', 'Bharat Spice Exports', 'Exporter', 'V. Iyer', 'Kerala', 'Kochi', 120, ['Turmeric', 'Chilli', 'Coriander', 'Cumin'], 10000, 100000, 14, 4.8, 56, 'Spice exporter serving buyers in UAE, EU and US markets.'),
  buyer('b5', 'GreenLeaf Institutional', 'Institutional', 'S. Das', 'Telangana', 'Hyderabad', 55, ['Rice', 'Wheat', 'Maize'], 20000, 200000, 30, 4.1, 31, 'Institutional buyer serving mid-day meal schemes and hostels.'),
  buyer('b6', 'AgriBazaar Digital', 'Digital', 'N. Khan', 'Maharashtra', 'Pune', 65, ['Tomato', 'Onion', 'Cotton', 'Groundnut'], 1000, 50000, 2, 4.0, 412, 'Online agriculture marketplace - direct settlement within 48 hours.'),
  buyer('b7', 'Sahara Cold Storage Co.', 'Processor', 'A. Verma', 'Uttar Pradesh', 'Lucknow', 95, ['Potato', 'Apple', 'Tomato'], 10000, 80000, 7, 4.3, 78, 'Cold storage and post-harvest handling for perishable produce.'),
  buyer('b8', 'Sunrise Oil Mills', 'Processor', 'B. Patel', 'Gujarat', 'Rajkot', 140, ['Groundnut', 'Cotton'], 30000, 200000, 10, 4.5, 120, 'Edible oil extraction unit - large volume groundnut and cotton seed buyer.'),
  buyer('b9', 'Vindhya Organics FPO', 'FPO', 'K. Patel', 'Madhya Pradesh', 'Indore', 75, ['Soybean', 'Wheat', 'Maize'], 8000, 60000, 5, 4.2, 64, 'Member-led FPO supporting 1,200 smallholder soybean farmers.'),
  buyer('b10', 'Annam Direct Retail', 'Retailer', 'C. Naidu', 'Andhra Pradesh', 'Guntur', 30, ['Chilli', 'Cotton', 'Pigeon Pea'], 300, 5000, 4, 4.4, 187, 'Direct-from-farm retail with regional cold-chain stores.'),
  buyer('b11', 'Northern Spice Imports', 'Institutional', 'D. Singh', 'Delhi', 'New Delhi', 180, ['Turmeric', 'Chilli', 'Cumin'], 20000, 150000, 21, 4.0, 19, 'Bulk spices procurement for institutional kitchens and defence.', 'pending'),
  buyer('b12', 'Bharat Cotton Hub', 'Exporter', 'G. Mehta', 'Maharashtra', 'Akola', 62, ['Cotton'], 25000, 300000, 15, 4.6, 73, 'Long-staple cotton exporter for textile mills in Bangladesh and Vietnam.'),
];

export const DEMO_LOTS: LotRecord[] = [
  {id: 'lot-1', farmerId: DEMO_FARMER_UID_SEED, crop: 'Tomato', variety: 'Hybrid-1101', quantityKg: 500, qualityGrade: 'A', qualityNotes: 'Firm, uniform red colour, free from cracks. Harvested 1 day ago.', expectedPricePerKg: 24, state: 'Karnataka', district: 'Kolar', village: 'Srinivasapura', harvestDate: today, images: [], status: 'active', isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lot-2', farmerId: DEMO_FARMER_UID_SEED, crop: 'Onion', variety: 'Bellary Red', quantityKg: 1200, qualityGrade: 'B', qualityNotes: 'Medium size, some loose skin. Sorted and bagged in 50kg mesh bags.', expectedPricePerKg: 21, state: 'Karnataka', district: 'Kolar', village: 'Srinivasapura', harvestDate: today, images: [], status: 'active', isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lot-3', farmerId: DEMO_FARMER_UID_SEED, crop: 'Chilli', variety: 'Teja S-17', quantityKg: 200, qualityGrade: 'A', qualityNotes: 'Sun-dried, low moisture (<10%), bright red colour.', expectedPricePerKg: 105, state: 'Andhra Pradesh', district: 'Guntur', village: 'Tadikonda', harvestDate: today, images: [], status: 'matched', isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lot-4', farmerId: DEMO_FARMER_UID_SEED, crop: 'Maize', variety: 'NK-6240', quantityKg: 3000, qualityGrade: 'B', qualityNotes: 'Moisture ~14%, some broken kernels. Bulk-ready.', expectedPricePerKg: 21, state: 'Karnataka', district: 'Davangere', village: 'Harihara', harvestDate: today, images: [], status: 'draft', isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
];

const makeOffer = (
  id: string, lotId: string, buyerId: string, buyerName: string,
  crop: string, verified: boolean, pricePerKg: number, quantityKg: number,
  validDays: number, status: OfferRecord['status'], terms: string,
): OfferRecord => {
  const amount = pricePerKg * quantityKg;
  return {
    id, lotId, buyerId, buyerName, crop, pricePerKg, offeredPricePerKg: pricePerKg,
    amount, totalAmount: amount, quantityKg, validUntil: futureIso(validDays),
    status, terms, buyerVerified: verified, counteredFromId: null,
    isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
};

export const DEMO_OFFERS: OfferRecord[] = [
  makeOffer('off-1', 'lot-1', 'b1', 'Sri Lakshmi Foods', 'Tomato', true, 24, 500, 3, 'pending', 'Pickup at farm gate within 24 hours. NET-3 payment terms.'),
  makeOffer('off-2', 'lot-1', 'b6', 'AgriBazaar Digital', 'Tomato', true, 23.5, 500, 2, 'pending', 'Settlement within 48 hours via UPI/NEFT. Farmer bears transport.'),
  makeOffer('off-3', 'lot-3', 'b4', 'Bharat Spice Exports', 'Chilli', true, 108, 200, 5, 'pending', 'Quality inspection at buyer warehouse. NET-14 settlement.'),
  makeOffer('off-4', 'lot-3', 'b11', 'Northern Spice Imports', 'Chilli', false, 101, 200, 2, 'pending', 'Verification required before contract finalisation.'),
];

export const DEMO_PAYMENTS: PaymentRecordDoc[] = [
  {
    id: 'pay-1', lotId: 'lot-3', buyerId: 'b4', buyerName: 'Bharat Spice Exports',
    crop: 'Chilli', quantityKg: 200, amount: 200 * 108, status: 'completed',
    reference: 'DEMO-PAY-1042', method: 'NEFT', lotSummary: 'Chilli - 200kg - Teja S-17',
    timeline: [
      {label: 'Lot Created', status: 'done', timestamp: isoMinus(9)},
      {label: 'Buyer Offer', status: 'done', timestamp: isoMinus(8)},
      {label: 'Offer Accepted', status: 'done', timestamp: isoMinus(7)},
      {label: 'Delivered', status: 'done', timestamp: isoMinus(3)},
      {label: 'Payment Processing', status: 'done', timestamp: isoMinus(2)},
      {label: 'Payment Received', status: 'done', timestamp: isoMinus(1)},
    ],
    farmerId: DEMO_FARMER_UID_SEED, isDemo: true,
    createdAt: isoMinus(7), updatedAt: isoMinus(1), completedAt: isoMinus(1),
  },
  {
    id: 'pay-2', lotId: 'lot-1', buyerId: 'b1', buyerName: 'Sri Lakshmi Foods',
    crop: 'Tomato', quantityKg: 500, amount: 500 * 24, status: 'pending',
    reference: 'DEMO-PAY-1055', method: 'UPI', lotSummary: 'Tomato - 500kg - Hybrid-1101',
    timeline: [
      {label: 'Lot Created', status: 'done', timestamp: isoMinus(2)},
      {label: 'Buyer Offer', status: 'done', timestamp: isoMinus(1)},
      {label: 'Offer Accepted', status: 'done', timestamp: isoMinus(1)},
      {label: 'Delivered', status: 'current', timestamp: null},
      {label: 'Payment Processing', status: 'upcoming', timestamp: null},
      {label: 'Payment Received', status: 'upcoming', timestamp: null},
    ],
    farmerId: DEMO_FARMER_UID_SEED, isDemo: true,
    createdAt: isoMinus(1), updatedAt: isoMinus(1), completedAt: null,
  },
];

export const DEMO_GRIEVANCES: GrievanceRecord[] = [
  {
    id: 'gv-1', farmerId: DEMO_FARMER_UID_SEED, raisedBy: 'Ramesh Kumar',
    lotId: 'lot-1',
    category: 'payment', subject: 'Payment delayed beyond NET-7 window',
    description: 'Buyer accepted the lot but payment has not been received within the agreed NET-7 window.',
    priority: 'high', transactionRef: 'DEMO-PAY-1055', status: 'in_review',
    assignedTo: 'Farmer Welfare Cell',
    resolutionNotes: 'Verification under progress. Buyer has been asked to share payment proof.',
    createdAt: isoMinus(3), updatedAt: isoMinus(3), submittedAt: isoMinus(3), resolvedAt: null,
    isDemo: true,
  },
  {
    id: 'gv-2', farmerId: DEMO_FARMER_UID_SEED, raisedBy: 'Ramesh Kumar',
    lotId: 'lot-3',
    category: 'logistics', subject: 'Truck arrived 5 hours late without notice',
    description: 'Truck arrived 5 hours late and there was no prior notice from transporter.',
    priority: 'medium', transactionRef: 'DEMO-LG-1001', status: 'resolved',
    assignedTo: 'Logistics Helpdesk', resolutionNotes: 'Compensation of 600 INR credited to farmer wallet.',
    createdAt: isoMinus(14), updatedAt: isoMinus(10), submittedAt: isoMinus(14), resolvedAt: isoMinus(10),
    isDemo: true,
  },
];

export const DEMO_STORAGE_OPTIONS: StorageOptionRecord[] = [
  {id: 'st-1', facilityName: 'Kolar Cooperative Warehouse', facilityType: 'warehouse', capacityTons: 250, availableTons: 80, state: 'Karnataka', district: 'Kolar', costPerQuintalPerDay: 4, distanceKm: 6, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'st-2', facilityName: 'ColdChain Karnataka', facilityType: 'cold_storage', capacityTons: 120, availableTons: 35, state: 'Karnataka', district: 'Kolar', costPerQuintalPerDay: 12, distanceKm: 11, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'st-3', facilityName: 'APMC Storage Hub', facilityType: 'warehouse', capacityTons: 800, availableTons: 280, state: 'Andhra Pradesh', district: 'Guntur', costPerQuintalPerDay: 3.5, distanceKm: 24, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'st-4', facilityName: 'Maharashtra ColdGrid', facilityType: 'cold_storage', capacityTons: 320, availableTons: 110, state: 'Maharashtra', district: 'Pune', costPerQuintalPerDay: 11, distanceKm: 60, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
];

export const DEMO_LOGISTICS_OPTIONS: LogisticsOptionRecord[] = [
  {id: 'lg-1', providerName: 'Krishi Roadways', vehicleType: 'small_truck', capacityTons: 1.5, costPerKm: 38, estimatedCost: 38 * 35, estimatedHours: 4, distanceKm: 35, fromLocation: 'Srinivasapura, Kolar', toLocation: 'Azadpur Mandi, Delhi', insured: true, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lg-2', providerName: 'Bharat Movers', vehicleType: 'medium_truck', capacityTons: 5, costPerKm: 52, estimatedCost: 52 * 35, estimatedHours: 6, distanceKm: 35, fromLocation: 'Srinivasapura, Kolar', toLocation: 'Azadpur Mandi, Delhi', insured: true, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lg-3', providerName: 'AgriRelocate', vehicleType: 'tempo', capacityTons: 1, costPerKm: 32, estimatedCost: 32 * 35, estimatedHours: 5, distanceKm: 35, fromLocation: 'Srinivasapura, Kolar', toLocation: 'Azadpur Mandi, Delhi', insured: false, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  {id: 'lg-4', providerName: 'SouthCargo Logistics', vehicleType: 'large_truck', capacityTons: 14, costPerKm: 78, estimatedCost: 78 * 35, estimatedHours: 8, distanceKm: 35, fromLocation: 'Srinivasapura, Kolar', toLocation: 'Azadpur Mandi, Delhi', insured: true, isDemo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
];