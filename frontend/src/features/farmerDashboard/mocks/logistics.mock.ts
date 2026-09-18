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

const todayIso = new Date().toISOString();

export const DEMO_LOGISTICS_OPTIONS: LogisticsOption[] = [
  {
    id: "lg-1",
    providerName: "Krishi Roadways",
    vehicleType: "small_truck",
    capacityTons: 1.5,
    costPerKm: 38,
    estimatedCost: 38 * 35,
    estimatedHours: 4,
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    isDemo: true,
  },
  {
    id: "lg-2",
    providerName: "Bharat Movers",
    vehicleType: "medium_truck",
    capacityTons: 5,
    costPerKm: 52,
    estimatedCost: 52 * 35,
    estimatedHours: 6,
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    isDemo: true,
  },
  {
    id: "lg-3",
    providerName: "AgriRelocate",
    vehicleType: "tempo",
    capacityTons: 1,
    costPerKm: 32,
    estimatedCost: 32 * 35,
    estimatedHours: 5,
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
    isDemo: true,
  },
  {
    id: "lg-4",
    providerName: "SouthCargo Logistics",
    vehicleType: "large_truck",
    capacityTons: 14,
    costPerKm: 78,
    estimatedCost: 78 * 35,
    estimatedHours: 8,
    distanceKm: 35,
    fromLocation: "Srinivasapura, Kolar",
    toLocation: "Azadpur Mandi, Delhi",
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
    timeline: [
      { label: "Lot Created", status: "done", timestamp: isoMinus(9) },
      { label: "Buyer Offer", status: "done", timestamp: isoMinus(8) },
      { label: "Offer Accepted", status: "done", timestamp: isoMinus(7) },
      { label: "Delivered", status: "done", timestamp: isoMinus(3) },
      { label: "Payment Processing", status: "done", timestamp: isoMinus(2) },
      {
        label: "Payment Received",
        status: "done",
        timestamp: isoMinus(1),
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
    timeline: [
      { label: "Lot Created", status: "done", timestamp: isoMinus(2) },
      { label: "Buyer Offer", status: "done", timestamp: isoMinus(1) },
      { label: "Offer Accepted", status: "done", timestamp: isoMinus(1) },
      { label: "Delivered", status: "current", timestamp: null },
      { label: "Payment Processing", status: "upcoming", timestamp: null },
      {
        label: "Payment Received",
        status: "upcoming",
        timestamp: null,
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
    description:
      "Buyer accepted the lot but payment has not been received within the agreed NET-7 window.",
    transactionRef: "DEMO-PAY-1055",
    status: "in_review",
    assignedTo: "Farmer Welfare Cell",
    resolutionNotes:
      "Verification under progress. Buyer has been asked to share payment proof.",
    submittedAt: isoMinus(3),
    resolvedAt: null,
    isDemo: true,
  },
  {
    id: "gv-2",
    raisedBy: "Ramesh Kumar",
    category: "transport",
    description:
      "Truck arrived 5 hours late and there was no prior notice from transporter.",
    transactionRef: "DEMO-LG-1001",
    status: "resolved",
    assignedTo: "Logistics Helpdesk",
    resolutionNotes: "Compensation of ₹600 credited to farmer wallet.",
    submittedAt: isoMinus(14),
    resolvedAt: isoMinus(10),
    isDemo: true,
  },
];

export const findDemoGrievanceById = (id: string): Grievance | undefined =>
  DEMO_GRIEVANCES.find((g) => g.id === id);
