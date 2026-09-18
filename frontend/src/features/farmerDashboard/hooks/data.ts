/**
 * Farmer Dashboard data hooks — Part 1 (store + core queries).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  LogisticsOption,
  MarketPriceResponse,
  Offer,
  PaymentRecord,
  StorageOption,
} from "../types";

// In-memory state for mutations created in the UI session.
interface FarmerDashboardState {
  lots: FarmerLot[];
  offers: Offer[];
  grievances: Grievance[];
  addLot: (lot: FarmerLot) => void;
  updateLot: (id: string, partial: Partial<FarmerLot>) => void;
  addOffer: (offer: Offer) => void;
  updateOffer: (id: string, partial: Partial<Offer>) => void;
  addGrievance: (g: Grievance) => void;
}

export const useFarmerDashboardStore = create<FarmerDashboardState>(
  (set) => ({
    lots: [...DEMO_LOTS],
    offers: [...DEMO_OFFERS],
    grievances: [...DEMO_GRIEVANCES],
    addLot: (lot) =>
      set((state) => ({ lots: [lot, ...state.lots] })),
    updateLot: (id, partial) =>
      set((state) => ({
        lots: state.lots.map((l) =>
          l.id === id ? { ...l, ...partial } : l
        ),
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
  variety: string;
  quantityKg: number;
  qualityGrade: "A" | "B" | "C";
  qualityNotes: string;
  expectedPricePerKg: number;
  state: string;
  district: string;
  village: string;
  harvestDate: string;
  images: string[];
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
        variety: input.variety,
        quantityKg: input.quantityKg,
        qualityGrade: input.qualityGrade,
        qualityNotes: input.qualityNotes,
        expectedPricePerKg: input.expectedPricePerKg,
        state: input.state,
        district: input.district,
        village: input.village,
        harvestDate: input.harvestDate,
        images: input.images,
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
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
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
  description: string;
  transactionRef: string;
}

export const useCreateGrievance = () => {
  const qc = useQueryClient();
  const addGrievance = useFarmerDashboardStore((s) => s.addGrievance);
  return useMutation<Grievance, Error, CreateGrievanceInput>({
    mutationFn: async (input) => {
      await delay(180);
      const id = "gv-" + Math.random().toString(36).slice(2, 9);
      const g: Grievance = {
        id,
        raisedBy: "You",
        category: input.category,
        description: input.description,
        transactionRef: input.transactionRef,
        status: "open",
        assignedTo: "Pending assignment",
        resolutionNotes: "",
        submittedAt: new Date().toISOString(),
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


