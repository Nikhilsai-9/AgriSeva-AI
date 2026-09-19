/**
 * Farmer Dashboard data hooks — Part 1 (store + core queries).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { create } from "zustand";

import {
  DEMO_FARMER_UID,
  DEMO_LOTS,
  DEMO_OFFERS,
  DEMO_GRIEVANCES,
  findDemoLotById,
  findDemoOffersForLot,
} from "../mocks/lots.mock";
import {
  DEMO_BUYERS,
  findDemoBuyerById,
} from "../mocks/buyers.mock";
import { DEMO_FARMER_PROFILE } from "../mocks/farmer-profile.mock";
import {
  DEMO_LOGISTICS_OPTIONS,
  DEMO_STORAGE_OPTIONS,
  DEMO_PAYMENTS,
} from "../mocks/logistics.mock";
import {
  buildDemoMarketPriceResponse,
  DEMO_MARKET_PRICES,
  DEMO_TODAY_INSIGHT,
} from "../mocks/market-prices.mock";

import type {
  Buyer,
  FarmerLot,
  FarmerProfile,
  Grievance,
  GrievanceCategory,
  GrievancePriority,
  LogisticsOption,
  MarketPriceResponse,
  Offer,
  PaymentRecord,
  StorageOption,
  StorageView,
} from "../types";

// In-memory state for mutations created in the UI session.
export interface StorageBooking {
  id: string;
  storageId: string;
  storageName: string;
  storageType: "warehouse" | "cold" | "silo";
  reservedKg: number;
  durationDays: number;
  expectedArrival: string;
  lotId: string | null;
  lotSummary: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  isDemo: boolean;
}

export interface NotificationItem {
  id: string;
  kind: "offer" | "payment" | "grievance" | "lot" | "system";
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

interface FarmerDashboardState {
  lots: FarmerLot[];
  offers: Offer[];
  grievances: Grievance[];
  storageBookings: StorageBooking[];
  notifications: NotificationItem[];
  addLot: (lot: FarmerLot) => void;
  updateLot: (id: string, partial: Partial<FarmerLot>) => void;
  removeLot: (id: string) => void;
  addOffer: (offer: Offer) => void;
  updateOffer: (id: string, partial: Partial<Offer>) => void;
  addGrievance: (g: Grievance) => void;
  addStorageBooking: (b: StorageBooking) => void;
  updateStorageBooking: (
    id: string,
    partial: Partial<StorageBooking>,
  ) => void;
  pushNotification: (n: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

export const useFarmerDashboardStore = create<FarmerDashboardState>(
  (set) => ({
    lots: [...DEMO_LOTS],
    offers: [...DEMO_OFFERS],
    grievances: [...DEMO_GRIEVANCES],
    storageBookings: [],
    notifications: [],
    addLot: (lot) =>
      set((state) => ({ lots: [lot, ...state.lots] })),
    updateLot: (id, partial) =>
      set((state) => ({
        lots: state.lots.map((l) =>
          l.id === id ? { ...l, ...partial } : l
        ),
      })),
    removeLot: (id) =>
      set((state) => ({
        lots: state.lots.filter((l) => l.id !== id),
        offers: state.offers.filter((o) => o.lotId !== id),
      })),
    addOffer: (offer) =>
      set((state) => ({ offers: [offer, ...state.offers] })),
    updateOffer: (id, partial) =>
      set((state) => ({
        offers: state.offers.map((o) =>
          o.id === id ? { ...o, ...partial } : o
        ),
      })),
    addGrievance: (g) =>
      set((state) => ({ grievances: [g, ...state.grievances] })),
    addStorageBooking: (b) =>
      set((state) => ({
        storageBookings: [b, ...state.storageBookings],
      })),
    updateStorageBooking: (id, partial) =>
      set((state) => ({
        storageBookings: state.storageBookings.map((b) =>
          b.id === id ? { ...b, ...partial } : b,
        ),
      })),
    pushNotification: (n) =>
      set((state) => ({
        notifications: [n, ...state.notifications].slice(0, 50),
      })),
    markNotificationRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      })),
    markAllNotificationsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read: true,
        })),
      })),
  })
);

// Core queries.
export const useFarmerProfile = () =>
  useQuery<FarmerProfile>({
    queryKey: ["farmer", "profile"],
    queryFn: async () => {
      await delay(120);
      return DEMO_FARMER_PROFILE;
    },
    staleTime: 60_000,
  });

export interface FarmerProfilePatch {
  name?: string;
  phone?: string;
  state?: string;
  district?: string;
  village?: string;
  /** Optional override; persisted into `primaryCrops[0]` when present. */
  primaryCrop?: string;
}

export const useUpdateFarmerProfile = () => {
  const qc = useQueryClient();
  return useMutation<FarmerProfile, Error, FarmerProfilePatch>({
    mutationFn: async (patch) => {
      await delay(180);
      // The profile lives in mock land today; in a real backend this would
      // be a PATCH/PUT. We mutate the cached query data so callers see the
      // update immediately.
      const current =
        qc.getQueryData<FarmerProfile>(["farmer", "profile"]) ??
        DEMO_FARMER_PROFILE;
      const next: FarmerProfile = {
        ...current,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.district !== undefined ? { district: patch.district } : {}),
        ...(patch.village !== undefined ? { village: patch.village } : {}),
        ...(patch.primaryCrop !== undefined
          ? { primaryCrops: [patch.primaryCrop, ...current.primaryCrops.filter((c) => c !== patch.primaryCrop)] }
          : {}),
      };
      qc.setQueryData(["farmer", "profile"], next);
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "profile"] });
    },
  });
};

export const useTodayInsight = () =>
  useQuery({
    queryKey: ["farmer", "todayInsight"],
    queryFn: async () => {
      await delay(120);
      return DEMO_TODAY_INSIGHT;
    },
    staleTime: 60_000,
  });

// Market prices.
export interface MarketPriceQuery {
  state?: string;
  district?: string;
  commodity?: string;
  arrivalDate?: string;
}

export const useMarketPrices = (query: MarketPriceQuery) =>
  useQuery<MarketPriceResponse>({
    queryKey: ["farmer", "marketPrices", query],
    queryFn: async () => {
      await delay(180);
      const commodity = query.commodity || "Tomato";
      return buildDemoMarketPriceResponse(commodity);
    },
    staleTime: 30_000,
  });

export const useAllMarketPrices = () =>
  useQuery({
    queryKey: ["farmer", "allMarketPrices"],
    queryFn: async () => {
      await delay(120);
      return DEMO_MARKET_PRICES;
    },
    staleTime: 60_000,
  });

// Buyers.
export const useBuyers = (filters?: {
  state?: string;
  crop?: string;
}) =>
  useQuery<Buyer[]>({
    queryKey: ["farmer", "buyers", filters ?? {}],
    queryFn: async () => {
      await delay(140);
      let result = [...DEMO_BUYERS];
      if (filters?.state) {
        result = result.filter(
          (b) =>
            b.state.toLowerCase() === filters.state!.toLowerCase()
        );
      }
      if (filters?.crop) {
        const c = filters.crop.toLowerCase();
        result = result.filter((b) =>
          b.cropsInterested.some((x) => x.toLowerCase().includes(c))
        );
      }
      return result;
    },
    staleTime: 60_000,
  });

export const useBuyer = (id: string | undefined) =>
  useQuery<Buyer | null>({
    queryKey: ["farmer", "buyer", id],
    queryFn: async () => {
      await delay(120);
      if (!id) return null;
      return findDemoBuyerById(id) ?? null;
    },
    enabled: !!id,
    staleTime: 60_000,
  });

// Lots.
export const useMyLots = () => {
  const store = useFarmerDashboardStore();
  const qc = useQueryClient();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
  }, [store.lots, qc]);
  return useQuery<FarmerLot[]>({
    queryKey: ["farmer", "lots"],
    queryFn: async () => {
      await delay(120);
      return store.lots.filter((l) => l.farmerId === DEMO_FARMER_UID);
    },
    initialData: store.lots.filter((l) => l.farmerId === DEMO_FARMER_UID),
    staleTime: 30_000,
  });
};

export const useLot = (id: string | undefined) => {
  const store = useFarmerDashboardStore();
  return useQuery<FarmerLot | null>({
    queryKey: ["farmer", "lot", id],
    queryFn: async () => {
      await delay(120);
      if (!id) return null;
      const inMemory = store.lots.find((l) => l.id === id);
      if (inMemory) return inMemory;
      return findDemoLotById(id) ?? null;
    },
    enabled: !!id,
    initialData: () => {
      if (!id) return undefined;
      return (
        store.lots.find((l) => l.id === id) ??
        findDemoLotById(id) ??
        undefined
      );
    },
    staleTime: 30_000,
  });
};

interface CreateLotInput {
  crop: string;
  variety?: string;
  quantityKg: number;
  qualityGrade: "A" | "B" | "C";
  qualityNotes?: string;
  expectedPricePerKg: number;
  state: string;
  district: string;
  village?: string;
  harvestDate: string;
  images?: string[];
  notes?: string;
}

export const useCreateLot = () => {
  const qc = useQueryClient();
  const addLot = useFarmerDashboardStore((s) => s.addLot);
  return useMutation<FarmerLot, Error, CreateLotInput>({
    mutationFn: async (input) => {
      await delay(180);
      const id = "lot-" + Math.random().toString(36).slice(2, 9);
      const lot: FarmerLot = {
        id,
        farmerId: DEMO_FARMER_UID,
        crop: input.crop,
        variety: input.variety ?? "",
        quantityKg: input.quantityKg,
        qualityGrade: input.qualityGrade,
        qualityNotes: input.qualityNotes ?? "",
        expectedPricePerKg: input.expectedPricePerKg,
        state: input.state,
        district: input.district,
        village: input.village ?? "",
        harvestDate: input.harvestDate,
        images: input.images ?? [],
        notes: input.notes,
        status: "active",
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
      addLot(lot);
      return lot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
    },
  });
};

// Offers.
export const useOffersForLot = (lotId: string | undefined) => {
  const store = useFarmerDashboardStore();
  return useQuery<Offer[]>({
    queryKey: ["farmer", "offers", lotId],
    queryFn: async () => {
      await delay(120);
      if (!lotId) return [];
      return store.offers.filter((o) => o.lotId === lotId);
    },
    enabled: !!lotId,
    initialData: () => {
      if (!lotId) return undefined;
      const inMemory = store.offers.filter((o) => o.lotId === lotId);
      if (inMemory.length > 0) return inMemory;
      return findDemoOffersForLot(lotId);
    },
    staleTime: 30_000,
  });
};

export const useAllMyOffers = () => {
  const store = useFarmerDashboardStore();
  return useQuery<Offer[]>({
    queryKey: ["farmer", "offers", "all"],
    queryFn: async () => {
      await delay(120);
      return store.offers;
    },
    initialData: store.offers,
    staleTime: 30_000,
  });
};

export const useUpdateOfferStatus = () => {
  const qc = useQueryClient();
  const updateOffer = useFarmerDashboardStore((s) => s.updateOffer);
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  const pushNotification = useFarmerDashboardStore(
    (s) => s.pushNotification,
  );
  return useMutation<
    Offer,
    Error,
    { offerId: string; status: Offer["status"] }
  >({
    mutationFn: async ({ offerId, status }) => {
      await delay(140);
      updateOffer(offerId, { status });
      const updated = useFarmerDashboardStore
        .getState()
        .offers.find((o) => o.id === offerId);
      if (!updated) throw new Error("Offer missing after update");

      // Auto-upsert a PaymentRecord when an offer is accepted so
      // the PaymentsPage surfaces it immediately (market intelligence).
      if (status === "accepted") {
        const payments =
          qc.getQueryData<PaymentRecord[]>(["farmer", "payments"]) ??
          DEMO_PAYMENTS;
        const exists = payments.some((p) => p.lotId === updated.lotId);
        if (!exists) {
          const now = new Date().toISOString();
          const record: PaymentRecord = {
            id: "pay-" + Math.random().toString(36).slice(2, 9),
            lotId: updated.lotId,
            buyerName: updated.buyerName,
            crop: updated.crop ?? "",
            quantityKg: updated.quantityKg,
            amount: updated.amount,
            status: "pending",
            reference:
              "DEMO-PAY-" + Math.floor(1000 + Math.random() * 9000),
            createdAt: now,
            completedAt: null,
            lotSummary: `${updated.crop ?? "Lot"} • ${updated.quantityKg}kg`,
            method: "NEFT",
            timeline: [
              {
                label: "Lot Created",
                status: "done",
                timestamp: now,
                at: now,
              },
              {
                label: "Buyer Offer",
                status: "done",
                timestamp: now,
                at: now,
              },
              {
                label: "Offer Accepted",
                status: "done",
                timestamp: now,
                at: now,
              },
              { label: "Delivered", status: "current", timestamp: null, at: null },
              {
                label: "Payment Processing",
                status: "upcoming",
                timestamp: null,
                at: null,
              },
              {
                label: "Payment Received",
                status: "upcoming",
                timestamp: null,
                at: null,
              },
            ],
            isDemo: true,
          };
          qc.setQueryData<PaymentRecord[]>(
            ["farmer", "payments"],
            [record, ...payments],
          );
        }

        // Auto-transition: when an offer is accepted, move the lot to
        // "sold" and auto-reject any other pending offers for the
        // same lot so they disappear from the active offers view.
        const allOffers = useFarmerDashboardStore.getState().offers;
        const sameLot = allOffers.filter(
          (o) => o.lotId === updated.lotId,
        );
        for (const other of sameLot) {
          if (other.id !== updated.id && other.status === "pending") {
            updateOffer(other.id, { status: "rejected" });
          }
        }
        updateLot(updated.lotId, { status: "sold" });

        pushNotification({
          id: "n-offer-" + updated.id,
          kind: "offer",
          title: "Offer accepted",
          body:
            updated.buyerName +
            " - " +
            (updated.crop ?? "Lot") +
            " accepted. Payment pending.",
          href: `/farmer/lots/${updated.lotId}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (status === "rejected") {
        pushNotification({
          id: "n-reject-" + updated.id,
          kind: "offer",
          title: "Offer rejected",
          body: updated.buyerName + " - " + (updated.crop ?? "Lot"),
          href: `/farmer/offers`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
      qc.invalidateQueries({ queryKey: ["farmer", "payments"] });
      qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
    },
  });
};

// Counter-offer: creates a NEW pending offer record for the same lot
// with a different price + status="countered". The original offer
// transitions to "countered" so the buyer can see the response.
export interface CounterOfferInput {
  originalOfferId: string;
  pricePerKg: number;
  message?: string;
}

export const useCounterOffer = () => {
  const qc = useQueryClient();
  const offers = useFarmerDashboardStore((s) => s.offers);
  const updateOffer = useFarmerDashboardStore((s) => s.updateOffer);
  const addOffer = useFarmerDashboardStore((s) => s.addOffer);
  const pushNotification = useFarmerDashboardStore(
    (s) => s.pushNotification,
  );
  return useMutation<Offer, Error, CounterOfferInput>({
    mutationFn: async ({ originalOfferId, pricePerKg, message }) => {
      await delay(160);
      const original = offers.find((o) => o.id === originalOfferId);
      if (!original) throw new Error("Original offer not found");
      const now = new Date().toISOString();
      const total = pricePerKg * original.quantityKg;
      const newOffer: Offer = {
        ...original,
        id: "offer-" + Math.random().toString(36).slice(2, 9),
        pricePerKg,
        offeredPricePerKg: pricePerKg,
        amount: total,
        totalAmount: total,
        status: "pending",
        terms: message ?? original.terms,
        createdAt: now,
      };
      updateOffer(originalOfferId, { status: "countered" });
      addOffer(newOffer);
      pushNotification({
        id: "n-counter-" + newOffer.id,
        kind: "offer",
        title: "Counter offer sent",
        body: "Rs " + pricePerKg + "/kg sent to " + original.buyerName,
        href: `/farmer/lots/${original.lotId}`,
        read: false,
        createdAt: now,
      });
      return newOffer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
    },
  });
};

// Update lot — used by LotDetailPage edit form.
export interface UpdateLotInput {
  id: string;
  patch: Partial<
    Omit<FarmerLot, "id" | "farmerId" | "createdAt" | "isDemo">
  >;
}

export const useUpdateLot = () => {
  const qc = useQueryClient();
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  return useMutation<FarmerLot, Error, UpdateLotInput>({
    mutationFn: async ({ id, patch }) => {
      await delay(160);
      updateLot(id, patch);
      const lot = useFarmerDashboardStore
        .getState()
        .lots.find((l) => l.id === id);
      if (!lot) throw new Error("Lot missing after update");
      return lot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
    },
  });
};

// Delete lot — also drops any related offers.
export const useDeleteLot = () => {
  const qc = useQueryClient();
  const removeLot = useFarmerDashboardStore((s) => s.removeLot);
  return useMutation<{ id: string }, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await delay(140);
      removeLot(id);
      return { id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
    },
  });
};

// Mark lot as sold (offline sale flow).
export const useMarkLotSold = () => {
  const qc = useQueryClient();
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  const pushNotification = useFarmerDashboardStore(
    (s) => s.pushNotification,
  );
  return useMutation<
    FarmerLot,
    Error,
    { id: string; finalPricePerKg: number; buyerName: string }
  >({
    mutationFn: async ({ id, finalPricePerKg, buyerName }) => {
      await delay(160);
      const existing = useFarmerDashboardStore
        .getState()
        .lots.find((l) => l.id === id);
      const noteSuffix =
        "[Offline sale] Sold to " +
        buyerName +
        " @ Rs " +
        finalPricePerKg +
        "/kg";
      const newNotes =
        (existing?.notes ?? "") +
        (existing?.notes ? "\n" : "") +
        noteSuffix;
      updateLot(id, { status: "sold", notes: newNotes });
      const lot = useFarmerDashboardStore
        .getState()
        .lots.find((l) => l.id === id);
      if (!lot) throw new Error("Lot missing after update");
      pushNotification({
        id: "n-sold-" + id,
        kind: "lot",
        title: "Lot marked sold",
        body: lot.crop + " - sold to " + buyerName,
        href: `/farmer/lots/${id}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return lot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "lots"] });
    },
  });
};

// Logistics & Storage.
export const useLogisticsOptions = () =>
  useQuery<LogisticsOption[]>({
    queryKey: ["farmer", "logistics"],
    queryFn: async () => {
      await delay(140);
      return DEMO_LOGISTICS_OPTIONS;
    },
    staleTime: 60_000,
  });

export const useStorageOptions = () =>
  useQuery<StorageOption[]>({
    queryKey: ["farmer", "storage"],
    queryFn: async () => {
      await delay(140);
      return DEMO_STORAGE_OPTIONS;
    },
    staleTime: 60_000,
  });

/**
 * UI-shaped storage list. Adapts the raw `StorageOption` mocks to the
 * shape expected by `StoragePage` (capacityKg / usedKg, name, location,
 * temperature, "warehouse" | "cold" type label).
 */
export const useStorage = () =>
  useQuery<StorageView[]>({
    queryKey: ["farmer", "storage", "view"],
    queryFn: async () => {
      await delay(140);
      const TONS_TO_KG = 1000;
      return DEMO_STORAGE_OPTIONS.map<StorageView>((s) => ({
        id: s.id,
        name: s.facilityName,
        type:
          s.facilityType === "cold_storage"
            ? "cold"
            : s.facilityType === "silo"
              ? "warehouse"
              : "warehouse",
        location: `${s.district}, ${s.state}`,
        temperatureC: s.facilityType === "cold_storage" ? 4 : null,
        capacityKg: s.capacityTons * TONS_TO_KG,
        usedKg: (s.capacityTons - s.availableTons) * TONS_TO_KG,
        isDemo: s.isDemo,
      }));
    },
    staleTime: 60_000,
  });

// Storage reservation mutation.
export interface ReserveStorageInput {
  storageId: string;
  storageName: string;
  storageType: "warehouse" | "cold" | "silo";
  reservedKg: number;
  durationDays: number;
  lotId: string | null;
  lotSummary: string;
}

export const useReserveStorage = () => {
  const qc = useQueryClient();
  const addStorageBooking = useFarmerDashboardStore(
    (s) => s.addStorageBooking,
  );
  const pushNotification = useFarmerDashboardStore(
    (s) => s.pushNotification,
  );
  return useMutation<StorageBooking, Error, ReserveStorageInput>({
    mutationFn: async (input) => {
      await delay(160);
      const now = new Date().toISOString();
      const arrival = new Date(
        Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const booking: StorageBooking = {
        id: "bk-" + Math.random().toString(36).slice(2, 9),
        storageId: input.storageId,
        storageName: input.storageName,
        storageType: input.storageType,
        reservedKg: input.reservedKg,
        durationDays: input.durationDays,
        expectedArrival: arrival,
        lotId: input.lotId,
        lotSummary: input.lotSummary,
        status: "confirmed",
        createdAt: now,
        isDemo: true,
      };
      addStorageBooking(booking);
      pushNotification({
        id: "n-storage-" + booking.id,
        kind: "system",
        title: "Storage reserved",
        body:
          input.storageName +
          " - " +
          input.reservedKg +
          "kg for " +
          input.durationDays +
          " days",
        href: `/farmer/storage`,
        read: false,
        createdAt: now,
      });
      return booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "storage"] });
      qc.invalidateQueries({ queryKey: ["farmer", "storageBookings"] });
    },
  });
};

export const useStorageBookings = () => {
  const store = useFarmerDashboardStore();
  return useQuery<StorageBooking[]>({
    queryKey: ["farmer", "storageBookings"],
    queryFn: async () => {
      await delay(80);
      return store.storageBookings;
    },
    initialData: store.storageBookings,
    staleTime: 30_000,
  });
};

// Payments.
export const usePayments = () =>
  useQuery<PaymentRecord[]>({
    queryKey: ["farmer", "payments"],
    queryFn: async () => {
      await delay(140);
      return DEMO_PAYMENTS;
    },
    staleTime: 60_000,
  });

// Grievances.
export const useGrievances = () => {
  const store = useFarmerDashboardStore();
  return useQuery<Grievance[]>({
    queryKey: ["farmer", "grievances"],
    queryFn: async () => {
      await delay(120);
      return store.grievances;
    },
    initialData: store.grievances,
    staleTime: 30_000,
  });
};

interface CreateGrievanceInput {
  category: GrievanceCategory;
  /** Short headline. Falls back to first 60 chars of description when omitted. */
  subject?: string;
  description: string;
  priority?: GrievancePriority;
  transactionRef: string;
}

export const useCreateGrievance = () => {
  const qc = useQueryClient();
  const addGrievance = useFarmerDashboardStore((s) => s.addGrievance);
  return useMutation<Grievance, Error, CreateGrievanceInput>({
    mutationFn: async (input) => {
      await delay(180);
      const id = "gv-" + Math.random().toString(36).slice(2, 9);
      const now = new Date().toISOString();
      const g: Grievance = {
        id,
        raisedBy: "You",
        category: input.category,
        subject:
          input.subject?.trim() ||
          (input.description.length > 60
            ? input.description.slice(0, 57) + "…"
            : input.description),
        description: input.description,
        priority: input.priority ?? "medium",
        transactionRef: input.transactionRef,
        status: "open",
        assignedTo: "Pending assignment",
        resolutionNotes: "",
        createdAt: now,
        submittedAt: now,
        resolvedAt: null,
        isDemo: true,
      };
      addGrievance(g);
      return g;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "grievances"] });
    },
  });
};

// Helpers.
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Logistics selection (persisted in localStorage for cross-page continuity).
export const useSelectedLogistics = () => {
  const [selectedId, setSelectedIdState] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem("farmer.selectedLogisticsId");
      } catch {
        return null;
      }
    },
  );
  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    try {
      if (id) localStorage.setItem("farmer.selectedLogisticsId", id);
      else localStorage.removeItem("farmer.selectedLogisticsId");
    } catch {
      // ignore
    }
  };
  return { selectedId, setSelectedId };
};

// Notifications feed. Synthesises fresh items from current data
// (pending offers, pending payments, open grievances) on top of any
// persisted notifications, so the bell reflects live state.
export const useNotifications = () => {
  const store = useFarmerDashboardStore();
  const qc = useQueryClient();
  return useQuery<NotificationItem[]>({
    queryKey: [
      "farmer",
      "notifications",
      store.offers.length,
      store.grievances.length,
      store.storageBookings.length,
    ],
    queryFn: async () => {
      await delay(40);
      const synthetic: NotificationItem[] = [];
      const pendingOffers = store.offers.filter(
        (o) => o.status === "pending",
      );
      for (const o of pendingOffers) {
        synthetic.push({
          id: "syn-offer-" + o.id,
          kind: "offer",
          title: "New offer from " + o.buyerName,
          body: "Rs " + o.pricePerKg + "/kg - " + o.quantityKg + "kg",
          href: `/farmer/lots/${o.lotId}`,
          read: false,
          createdAt: o.createdAt,
        });
      }
      const cachedPayments = qc.getQueryData<PaymentRecord[]>([
        "farmer",
        "payments",
      ]);
      const pendingPayments = (cachedPayments ?? []).filter(
        (p) => p.status === "pending",
      );
      for (const p of pendingPayments) {
        synthetic.push({
          id: "syn-pay-" + p.id,
          kind: "payment",
          title: "Payment pending",
          body: "Rs " + p.amount + " from " + p.buyerName,
          href: `/farmer/payments`,
          read: false,
          createdAt: p.createdAt,
        });
      }
      const openGrievances = store.grievances.filter(
        (g) => g.status === "open" || g.status === "in_review",
      );
      for (const g of openGrievances) {
        synthetic.push({
          id: "syn-gv-" + g.id,
          kind: "grievance",
          title: "Grievance " + g.status.replace("_", " "),
          body: g.subject,
          href: `/farmer/grievances`,
          read: false,
          createdAt: g.createdAt,
        });
      }
      const persisted = store.notifications;
      return [...synthetic, ...persisted].slice(0, 25);
    },
    initialData: [],
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
};

export const useMarkAllNotificationsRead = () => {
  const markAll = useFarmerDashboardStore(
    (s) => s.markAllNotificationsRead,
  );
  const qc = useQueryClient();
  return () => {
    markAll();
    qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
  };
};


