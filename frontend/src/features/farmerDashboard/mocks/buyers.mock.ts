/**
 * Demo Buyer Directory Data — clearly labelled.
 *
 * These records mimic verified agricultural buyers (FPOs, processors,
 * retailers, institutional, exporters, digital channels). They are used
 * ONLY to prototype the new farmer dashboard UI and are NOT connected
 * to any live buyer system.
 *
 * isDemo=true on every record.
 */

import type { Buyer, BuyerType } from "../types";

const isoMinusYears = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
};

const make = (
  id: string,
  businessName: string,
  businessType: BuyerType,
  contactPerson: string,
  state: string,
  district: string,
  distanceKm: number,
  cropsInterested: string[],
  minQuantityKg: number,
  maxQuantityKg: number,
  paymentTermsDays: number,
  rating: number,
  transactionsCount: number,
  description: string,
  verificationStatus: Buyer["verificationStatus"] = "verified",
  memberSinceYears = 3,
  preferredPayment = "NEFT / RTGS",
  website: string | null = null,
  phoneOverride: string | null = null
): Buyer => {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    id,
    name: businessName,
    type: businessType,
    businessName,
    businessType,
    verificationStatus,
    contactPerson,
    phone: phoneOverride ?? "+91 98000 00000",
    email: `${slug}@demo.example`,
    location: `${district}, ${state}`,
    state,
    district,
    distanceKm,
    cropsInterested,
    minQuantityKg,
    maxQuantityKg,
    paymentTermsDays,
    rating,
    transactionsCount,
    completedDeals: transactionsCount,
    description,
    website: website ?? `https://${slug}.demo.example`,
    memberSince: isoMinusYears(memberSinceYears),
    preferredPayment,
    notes: description,
    verified: verificationStatus === "verified",
    isDemo: true,
  };
};

export const DEMO_BUYERS: Buyer[] = [
  make(
    "b1",
    "Sri Lakshmi Foods",
    "Processor",
    "M. Reddy",
    "Tamil Nadu",
    "Krishnagiri",
    45,
    ["Tomato", "Onion", "Potato"],
    2000,
    5000,
    3,
    4.6,
    142,
    "Tomato ketchup, puree and sauce processing. Daily offload at factory."
  ),
  make(
    "b2",
    "Krishna Valley FPO",
    "FPO",
    "R. Rao",
    "Andhra Pradesh",
    "Krishna",
    28,
    ["Rice", "Maize", "Black Gram"],
    5000,
    50000,
    7,
    4.4,
    89,
    "Farmer Producer Organisation — collective sales and procurement."
  ),
  make(
    "b3",
    "Annapurna Retail Chains",
    "Retailer",
    "P. Sharma",
    "Karnataka",
    "Bangalore Urban",
    38,
    ["Tomato", "Onion", "Potato", "Chilli"],
    500,
    3000,
    5,
    4.2,
    234,
    "Retail chain — 84 stores across South India."
  ),
  make(
    "b4",
    "Bharat Spice Exports",
    "Exporter",
    "V. Iyer",
    "Kerala",
    "Kochi",
    120,
    ["Turmeric", "Chilli", "Coriander", "Cumin"],
    10000,
    100000,
    14,
    4.8,
    56,
    "Spice exporter serving buyers in UAE, EU and US markets."
  ),
  make(
    "b5",
    "GreenLeaf Institutional",
    "Institutional",
    "S. Das",
    "Telangana",
    "Hyderabad",
    55,
    ["Rice", "Wheat", "Maize"],
    20000,
    200000,
    30,
    4.1,
    31,
    "Institutional buyer serving mid-day meal schemes and hostels."
  ),
  make(
    "b6",
    "AgriBazaar Digital",
    "Digital",
    "N. Khan",
    "Maharashtra",
    "Pune",
    65,
    ["Tomato", "Onion", "Cotton", "Groundnut"],
    1000,
    50000,
    2,
    4.0,
    412,
    "Online agriculture marketplace — direct settlement within 48 hours."
  ),
  make(
    "b7",
    "Sahara Cold Storage Co.",
    "Processor",
    "A. Verma",
    "Uttar Pradesh",
    "Lucknow",
    95,
    ["Potato", "Apple", "Tomato"],
    10000,
    80000,
    7,
    4.3,
    78,
    "Cold storage and post-harvest handling for perishable produce."
  ),
  make(
    "b8",
    "Sunrise Oil Mills",
    "Processor",
    "B. Patel",
    "Gujarat",
    "Rajkot",
    140,
    ["Groundnut", "Cotton"],
    30000,
    200000,
    10,
    4.5,
    120,
    "Edible oil extraction unit — large volume groundnut and cotton seed buyer."
  ),
  make(
    "b9",
    "Vindhya Organics FPO",
    "FPO",
    "K. Patel",
    "Madhya Pradesh",
    "Indore",
    75,
    ["Soybean", "Wheat", "Maize"],
    8000,
    60000,
    5,
    4.2,
    64,
    "Member-led FPO supporting 1,200 smallholder soybean farmers."
  ),
  make(
    "b10",
    "Annam Direct Retail",
    "Retailer",
    "C. Naidu",
    "Andhra Pradesh",
    "Guntur",
    30,
    ["Chilli", "Cotton", "Pigeon Pea"],
    300,
    5000,
    4,
    4.4,
    187,
    "Direct-from-farm retail with regional cold-chain stores."
  ),
  make(
    "b11",
    "Northern Spice Imports",
    "Institutional",
    "D. Singh",
    "Delhi",
    "New Delhi",
    180,
    ["Turmeric", "Chilli", "Cumin"],
    20000,
    150000,
    21,
    4.0,
    19,
    "Bulk spices procurement for institutional kitchens and defence."
  ),
  make(
    "b12",
    "Bharat Cotton Hub",
    "Exporter",
    "G. Mehta",
    "Maharashtra",
    "Akola",
    62,
    ["Cotton"],
    25000,
    300000,
    15,
    4.6,
    73,
    "Long-staple cotton exporter for textile mills in Bangladesh and Vietnam."
  ),
];

export const findDemoBuyerById = (id: string): Buyer | undefined =>
  DEMO_BUYERS.find((b) => b.id === id);
