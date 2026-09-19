/**
 * Demo Logistics, Storage, Payment & Grievance Data.
 * All values clearly labelled as DEMO so the UI surfaces "Demo Data" chips.
 */

import type {
  LogisticsOption,
  StorageOption,
  PaymentRecord,
  Grievance,
} from "../types";

export const DEMO_LOGISTICS_OPTIONS: LogisticsOption[] = [
  {
    id: "lg-1",
    providerName: "Krishi Roadways",
    provider: "Krishi Roadways",
    vehicleType: "small_truck",
    capacityTons: 1.5,
    capacityKg: 1.5 * 1000,
    costPerKm: 38,
    ratePerKg: 38,
    estimatedCost: 38 * 35,
    estimatedHours: 4,
    estimatedDeliveryDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    from: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    to: "Azadpur Mandi, Delhi",
    insured: true,
    isDemo: true,
  },
  {
    id: "lg-2",
    providerName: "Bharat Movers",
    provider: "Bharat Movers",
    vehicleType: "medium_truck",
    capacityTons: 5,
    capacityKg: 5 * 1000,
    costPerKm: 52,
    ratePerKg: 52,
    estimatedCost: 52 * 35,
    estimatedHours: 6,
    estimatedDeliveryDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    from: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    to: "Azadpur Mandi, Delhi",
    insured: true,
    isDemo: true,
  },
  {
    id: "lg-3",
    providerName: "AgriRelocate",
    provider: "AgriRelocate",
    vehicleType: "tempo",
    capacityTons: 1,
    capacityKg: 1 * 1000,
    costPerKm: 32,
    ratePerKg: 32,
    estimatedCost: 32 * 35,
    estimatedHours: 5,
    estimatedDeliveryDate: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    from: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    to: "Azadpur Mandi, Delhi",
    insured: false,
    isDemo: true,
  },
  {
    id: "lg-4",
    providerName: "SouthCargo Logistics",
    provider: "SouthCargo Logistics",
    vehicleType: "large_truck",
    capacityTons: 14,
    capacityKg: 14 * 1000,
    costPerKm: 78,
    ratePerKg: 78,
    estimatedCost: 78 * 35,
    estimatedHours: 8,
    estimatedDeliveryDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    from: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    to: "Azadpur Mandi, Delhi",
    insured: true,
    isDemo: true,
  },
];

export const DEMO_STORAGE_OPTIONS: StorageOption[] = [
  {
    id: "st-1",
    facilityName: "Kolar Cooperative Warehouse",
    facilityType: "warehouse",
    capacityTons: 250,
    availableTons: 80,
    state: "Karnataka",
    district: "Kolar",
    costPerQuintalPerDay: 4,
    distanceKm: 6,
    isDemo: true,
  },
  {
    id: "st-2",
    facilityName: "ColdChain Karnataka",
    facilityType: "cold_storage",
    capacityTons: 120,
    availableTons: 35,
    state: "Karnataka",
    district: "Kolar",
    costPerQuintalPerDay: 12,
    distanceKm: 11,
    isDemo: true,
  },
  {
    id: "st-3",
    facilityName: "APMC Storage Hub",
    facilityType: "warehouse",
    capacityTons: 800,
    availableTons: 280,
    state: "Andhra Pradesh",
    district: "Chittoor",
    costPerQuintalPerDay: 5,
    distanceKm: 22,
    isDemo: true,
  },
];

const isoMinus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

export const DEMO_PAYMENTS: PaymentRecord[] = [
  {
    id: "pay-1",
    lotId: "lot-3",
    buyerName: "Bharat Spice Exports",
    crop: "Chilli",
    quantityKg: 200,
    amount: 200 * 108,
    status: "completed",
    reference: "DEMO-PAY-1042",
    createdAt: isoMinus(7),
    completedAt: isoMinus(1),
    lotSummary: "Chilli • 200kg • Teja S-17",
    method: "NEFT",
    timeline: [
      { label: "Lot Created", status: "done", timestamp: isoMinus(9), at: isoMinus(9) },
      { label: "Buyer Offer", status: "done", timestamp: isoMinus(8), at: isoMinus(8) },
      { label: "Offer Accepted", status: "done", timestamp: isoMinus(7), at: isoMinus(7) },
      { label: "Delivered", status: "done", timestamp: isoMinus(3), at: isoMinus(3) },
      { label: "Payment Processing", status: "done", timestamp: isoMinus(2), at: isoMinus(2) },
      {
        label: "Payment Received",
        status: "done",
        timestamp: isoMinus(1),
        at: isoMinus(1),
      },
    ],
    isDemo: true,
  },
  {
    id: "pay-2",
    lotId: "lot-1",
    buyerName: "Sri Lakshmi Foods",
    crop: "Tomato",
    quantityKg: 500,
    amount: 500 * 24,
    status: "pending",
    reference: "DEMO-PAY-1055",
    createdAt: isoMinus(1),
    completedAt: null,
    lotSummary: "Tomato • 500kg • Hybrid-1101",
    method: "UPI",
    timeline: [
      { label: "Lot Created", status: "done", timestamp: isoMinus(2), at: isoMinus(2) },
      { label: "Buyer Offer", status: "done", timestamp: isoMinus(1), at: isoMinus(1) },
      { label: "Offer Accepted", status: "done", timestamp: isoMinus(1), at: isoMinus(1) },
      { label: "Delivered", status: "current", timestamp: null, at: null },
      { label: "Payment Processing", status: "upcoming", timestamp: null, at: null },
      {
        label: "Payment Received",
        status: "upcoming",
        timestamp: null,
        at: null,
      },
    ],
    isDemo: true,
  },
];

export const findDemoPaymentById = (id: string): PaymentRecord | undefined =>
  DEMO_PAYMENTS.find((p) => p.id === id);

export const DEMO_GRIEVANCES: Grievance[] = [
  {
    id: "gv-1",
    raisedBy: "Ramesh Kumar",
    category: "payment",
    subject: "Payment delayed beyond NET-7 window",
    description:
      "Buyer accepted the lot but payment has not been received within the agreed NET-7 window.",
    priority: "high",
    transactionRef: "DEMO-PAY-1055",
    status: "in_review",
    assignedTo: "Farmer Welfare Cell",
    resolutionNotes:
      "Verification under progress. Buyer has been asked to share payment proof.",
    createdAt: isoMinus(3),
    submittedAt: isoMinus(3),
    resolvedAt: null,
    isDemo: true,
  },
  {
    id: "gv-2",
    raisedBy: "Ramesh Kumar",
    category: "logistics",
    subject: "Truck arrived 5 hours late without notice",
    description:
      "Truck arrived 5 hours late and there was no prior notice from transporter.",
    priority: "medium",
    transactionRef: "DEMO-LG-1001",
    status: "resolved",
    assignedTo: "Logistics Helpdesk",
    resolutionNotes: "Compensation of ₹600 credited to farmer wallet.",
    createdAt: isoMinus(14),
    submittedAt: isoMinus(14),
    resolvedAt: isoMinus(10),
    isDemo: true,
  },
];

export const findDemoGrievanceById = (id: string): Grievance | undefined =>
  DEMO_GRIEVANCES.find((g) => g.id === id);
