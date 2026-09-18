/**
 * Demo Farmer Lots Data — clearly labelled.
 *
 * These are prototype records only. They simulate the shape of data
 * a farmer dashboard would manage via a new lots collection, but they
 * are NOT connected to a live database.
 *
 * The current logged-in user's uid in the auth store is mocked as
 * "demo-farmer-uid" so the new dashboard can render these records
 * without touching any existing backend.
 */

import type { FarmerLot, Offer } from "../types";

const todayIso = new Date().toISOString().slice(0, 10);

export const DEMO_FARMER_UID = "demo-farmer-uid";

export const DEMO_LOTS: FarmerLot[] = [
  {
    id: "lot-1",
    farmerId: DEMO_FARMER_UID,
    crop: "Tomato",
    variety: "Hybrid-1101",
    quantityKg: 500,
    qualityGrade: "A",
    qualityNotes:
      "Firm, uniform red colour, free from cracks. Harvested 1 day ago.",
    expectedPricePerKg: 24,
    state: "Karnataka",
    district: "Kolar",
    village: "Srinivasapura",
    harvestDate: todayIso,
    images: [],
    status: "active",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "lot-2",
    farmerId: DEMO_FARMER_UID,
    crop: "Onion",
    variety: "Bellary Red",
    quantityKg: 1200,
    qualityGrade: "B",
    qualityNotes:
      "Medium size, some loose skin. Sorted and bagged in 50kg mesh bags.",
    expectedPricePerKg: 21,
    state: "Karnataka",
    district: "Kolar",
    village: "Srinivasapura",
    harvestDate: todayIso,
    images: [],
    status: "active",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "lot-3",
    farmerId: DEMO_FARMER_UID,
    crop: "Chilli",
    variety: "Teja S-17",
    quantityKg: 200,
    qualityGrade: "A",
    qualityNotes: "Sun-dried, low moisture (<10%), bright red colour.",
    expectedPricePerKg: 105,
    state: "Andhra Pradesh",
    district: "Guntur",
    village: "Tadikonda",
    harvestDate: todayIso,
    images: [],
    status: "matched",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "lot-4",
    farmerId: DEMO_FARMER_UID,
    crop: "Maize",
    variety: "NK-6240",
    quantityKg: 3000,
    qualityGrade: "B",
    qualityNotes: "Moisture ~14%, some broken kernels. Bulk-ready.",
    expectedPricePerKg: 21,
    state: "Karnataka",
    district: "Davangere",
    village: "Harihara",
    harvestDate: todayIso,
    images: [],
    status: "draft",
    createdAt: todayIso,
    isDemo: true,
  },
];

export const findDemoLotById = (id: string): FarmerLot | undefined =>
  DEMO_LOTS.find((l) => l.id === id);

const futureIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const DEMO_OFFERS: Offer[] = [
  {
    id: "off-1",
    lotId: "lot-1",
    buyerId: "b1",
    buyerName: "Sri Lakshmi Foods",
    verified: true,
    offeredPricePerKg: 24,
    totalAmount: 24 * 500,
    quantityKg: 500,
    validUntil: futureIso(3),
    status: "pending",
    terms: "Pickup at farm gate within 24 hours. NET-3 payment terms.",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "off-2",
    lotId: "lot-1",
    buyerId: "b6",
    buyerName: "AgriBazaar Digital",
    verified: true,
    offeredPricePerKg: 23.5,
    totalAmount: 23.5 * 500,
    quantityKg: 500,
    validUntil: futureIso(2),
    status: "pending",
    terms: "Settlement within 48 hours via UPI/NEFT. Farmer bears transport.",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "off-3",
    lotId: "lot-3",
    buyerId: "b4",
    buyerName: "Bharat Spice Exports",
    verified: true,
    offeredPricePerKg: 108,
    totalAmount: 108 * 200,
    quantityKg: 200,
    validUntil: futureIso(5),
    status: "pending",
    terms: "Quality inspection at buyer warehouse. NET-14 settlement.",
    createdAt: todayIso,
    isDemo: true,
  },
  {
    id: "off-4",
    lotId: "lot-3",
    buyerId: "b11",
    buyerName: "Northern Spice Imports",
    verified: false,
    offeredPricePerKg: 101,
    totalAmount: 101 * 200,
    quantityKg: 200,
    validUntil: futureIso(2),
    status: "pending",
    terms: "Verification required before contract finalisation.",
    createdAt: todayIso,
    isDemo: true,
  },
];

export const findDemoOffersForLot = (lotId: string): Offer[] =>
  DEMO_OFFERS.filter((o) => o.lotId === lotId);

export const findDemoOfferById = (id: string): Offer | undefined =>
  DEMO_OFFERS.find((o) => o.id === id);
