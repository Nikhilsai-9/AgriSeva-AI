/**
 * Farmer Dashboard data hooks — Part 1 (store + core queries).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { create } from "zustand";

import {
  DEMO_FARMER_UID,
  DEMO_LOTS,
  DEMO_OFFERS,
  DEMO_GRIEVANCES,
} from "../mocks/lots.mock";
import {
  DEMO_BUYERS,
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
import { env } from "@/config/env";

import type {
  Buyer,
  FarmerLot,
  FarmerProfile,
  Grievance,
  LogisticsOption,
  MarketPrice,
  MarketPriceResponse,
  Offer,
  PaymentRecord,
  StorageOption,
  StorageView,
  TodayInsight,
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

// Market prices.
export interface MarketPriceQuery {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  arrivalDate?: string;
  limit?: number;
}

/** Backend response shape for GET /api/market-prices. */
export interface BackendMarketPricesResponse {
  success: boolean;
  isDemo: boolean;
  source: string;
  fetchedAt: string;
  prices: Array<{
    recordKey: string;
    source: "agmarknet" | "enam" | "demo";
    sourceSystem: string;
    /** Upstream MCP/system URL — surfaced to the UI for provenance. */
    sourceUrl?: string;
    state: string;
    district?: string;
    market: string;
    commodity: string;
    crop?: string;
    variety?: string;
    grade?: string;
    /** Top-level commodity group (e.g. "Cereals"). */
    commodityGroup?: string;
    unit: string;
    minPrice?: number;
    maxPrice?: number;
    modalPrice?: number;
    arrivalQty?: number;
    arrivalDate: string;
    ingestedAt: string;
    changePct?: number | null;
    trendPct?: number | null;
    /** Distance from the requesting village/mandi (UI-only, when known). */
    distanceKm?: number | null;
  }>;
  total: number;
}

/** Backend response shape for GET /api/market-insights/today. */
export interface BackendTodayInsightResponse {
  success: boolean;
  isDemo: boolean;
  fetchedAt: string;
  insight: TodayInsight | null;
}

const buildQueryString = (params: Record<string, unknown>): string => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
};

const apiUrl = (path: string): string => {
  const base = env.apiBaseUrl().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

/** Map a backend MarketPriceRecord to the existing UI `MarketPrice`. */
const toUiMarketPrice = (
  r: BackendMarketPricesResponse["prices"][number],
): MarketPrice => ({
  id: r.recordKey,
  commodity: r.commodity,
  crop: r.crop ?? r.commodity,
  market: r.market,
  state: r.state,
  district: r.district ?? "",
  minPrice: r.minPrice ?? 0,
  maxPrice: r.maxPrice ?? 0,
  modalPrice: r.modalPrice ?? 0,
  changePct: r.changePct ?? 0,
  unit: r.unit,
  arrivalDate: r.arrivalDate,
  reportedAt: r.ingestedAt,
  source: r.source,
  trendPct: r.trendPct ?? undefined,
  // Live-backend passthrough — only set when the backend actually provides them,
  // so demo / synthetic records stay backward-compatible.
  recordKey: r.recordKey,
  sourceSystem: r.sourceSystem,
  sourceUrl: r.sourceUrl,
  variety: r.variety,
  grade: r.grade,
  commodityGroup: r.commodityGroup,
  arrivalQty: r.arrivalQty,
  distanceKm: r.distanceKm ?? undefined,
});

const buildResponseFromBackend = (
  data: BackendMarketPricesResponse,
  commodity: string,
): MarketPriceResponse => {
  const filtered = data.prices.filter((p) =>
    commodity ? p.commodity.toLowerCase().includes(commodity.toLowerCase()) : true,
  );
  const uiRows = filtered.map(toUiMarketPrice);
  const best = [...uiRows].sort((a, b) => b.modalPrice - a.modalPrice)[0] ?? null;
  return {
    success: data.success,
    bestMatch: best,
    alternatives: uiRows.filter((r) => r.id !== best?.id),
    totalResults: uiRows.length,
    errorMessage: data.success ? "" : "Backend returned an unsuccessful response",
    responseDate: data.fetchedAt,
    isDemo: data.isDemo || uiRows.length === 0,
  };
};

/**
 * Build a `MarketPriceResponse` representing a hard failure (network down,
 * non-2xx HTTP, malformed JSON).  Distinct from the "demo" branch — the
 * UI must render an explicit error/no-data state instead of treating
 * demo data as live.
 */
const errorMarketPriceResponse = (message: string): MarketPriceResponse => ({
  success: false,
  bestMatch: null,
  alternatives: [],
  totalResults: 0,
  errorMessage: message,
  responseDate: new Date().toISOString(),
  isDemo: false,
});

export const useMarketPrices = (query: MarketPriceQuery) =>
  useQuery<MarketPriceResponse>({
    queryKey: ["farmer", "marketPrices", query],
    queryFn: async () => {
      const commodity = query.commodity || "Tomato";
      let res: Response;
      try {
        const url =
          apiUrl("/market-prices") +
          buildQueryString({
            state: query.state,
            district: query.district,
            market: query.market,
            commodity: query.commodity,
            variety: query.variety,
            arrivalDate: query.arrivalDate,
            limit: query.limit ?? 100,
          });
        res = await fetch(url);
      } catch (err) {
        // Transport-level error (DNS, offline, CORS): do NOT silently
        // substitute demo data — surface as a failure so the page can render
        // an explicit error state.
        const message = err instanceof Error ? err.message : "Network error";
        return errorMarketPriceResponse(message);
      }
      if (!res.ok) {
        return errorMarketPriceResponse(`market-prices HTTP ${res.status}`);
      }
      let data: BackendMarketPricesResponse;
      try {
        data = (await res.json()) as BackendMarketPricesResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid JSON";
        return errorMarketPriceResponse(message);
      }
      // Backend explicitly says isDemo OR returned an empty payload:
      // substitute the documented demo dataset (this IS the supported
      // demo fallback contract, not an error).
      if (data.isDemo || data.prices.length === 0) {
        return buildDemoMarketPriceResponse(commodity);
      }
      return buildResponseFromBackend(data, commodity);
    },
    staleTime: 30_000,
  });

export const useAllMarketPrices = () =>
  useQuery<MarketPrice[]>({
    queryKey: ["farmer", "allMarketPrices"],
    queryFn: async () => {
      let res: Response;
      try {
        res = await fetch(apiUrl("/market-prices?limit=200"));
      } catch (err) {
        // Hard failure: propagate as a query error so the UI can render an
        // explicit error state instead of silently showing demo data.
        throw err instanceof Error ? err : new Error("Network error");
      }
      if (!res.ok) throw new Error(`market-prices HTTP ${res.status}`);
      const data: BackendMarketPricesResponse = await res.json();
      // Empty response → fall back to demo (documented contract).
      if (!data.prices.length) return DEMO_MARKET_PRICES;
      return data.prices.map(toUiMarketPrice);
    },
    staleTime: 60_000,
  });

export const useTodayInsight = (params?: {
  state?: string;
  market?: string;
  commodity?: string;
}) =>
  useQuery<TodayInsight | null>({
    queryKey: ["farmer", "todayInsight", params ?? {}],
    queryFn: async () => {
      let res: Response;
      try {
        const url =
          apiUrl("/market-insights/today") +
          buildQueryString({
            state: params?.state,
            market: params?.market,
            commodity: params?.commodity,
          });
        res = await fetch(url);
      } catch (err) {
        throw err instanceof Error ? err : new Error("Network error");
      }
      if (!res.ok) throw new Error(`market-insights HTTP ${res.status}`);
      const data: BackendTodayInsightResponse = await res.json();
      // Backend explicitly says demo OR no insight: documented demo fallback.
      if (data.isDemo || !data.insight) return DEMO_TODAY_INSIGHT;
      return data.insight;
    },
    staleTime: 60_000,
  });

/** Time-series points from GET /api/market-prices/history. */
export interface MarketHistoryPoint {
  arrivalDate: string;
  modalPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  source: string;
}

export const useMarketHistory = (params: {
  state: string;
  market: string;
  commodity: string;
  variety?: string;
  lookbackDays?: number;
}) =>
  useQuery<MarketHistoryPoint[]>({
    queryKey: ["farmer", "marketHistory", params],
    queryFn: async () => {
      const url =
        apiUrl("/market-prices/history") +
        buildQueryString({
          state: params.state,
          market: params.market,
          commodity: params.commodity,
          variety: params.variety,
          lookbackDays: params.lookbackDays ?? 30,
        });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`market-history HTTP ${res.status}`);
      const data = await res.json();
      return (data.points ?? []) as MarketHistoryPoint[];
    },
    enabled: Boolean(params.state && params.market && params.commodity),
    staleTime: 60_000,
  });

/** Cross-mandi comparison from GET /api/market-comparison. */
export interface MarketComparisonRow {
  state: string;
  market: string;
  commodity: string;
  modalPrice: number;
  minPrice?: number;
  maxPrice?: number;
  unit: string;
  arrivalDate: string;
  source: string;
  changePct?: number | null;
  trendPct?: number | null;
}

export interface MarketComparisonResult {
  isDemo: boolean;
  fetchedAt: string;
  rows: MarketComparisonRow[];
  recommendation: MarketComparisonRow | null;
}

export const useMarketComparison = (params: {
  commodity: string;
  state?: string;
  limit?: number;
}) =>
  useQuery<MarketComparisonResult>({
    queryKey: ["farmer", "marketComparison", params],
    queryFn: async () => {
      const url =
        apiUrl("/market-comparison") +
        buildQueryString({
          commodity: params.commodity,
          state: params.state,
          limit: params.limit ?? 20,
        });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`market-comparison HTTP ${res.status}`);
      return (await res.json()) as MarketComparisonResult;
    },
    enabled: Boolean(params.commodity),
    staleTime: 60_000,
  });

/** Per-source reliability from GET /api/market-prices/reliability. */
export interface MarketReliabilitySnapshot {
  source: string;
  score: number;
  label: string;
  reasons: string[];
  lastSuccessAt?: string | null;
  lastAttemptAt?: string | null;
  consecutiveFails: number;
}

export const useMarketReliability = (source?: string) =>
  useQuery<MarketReliabilitySnapshot[]>({
    queryKey: ["farmer", "marketReliability", source ?? "all"],
    queryFn: async () => {
      const url =
        apiUrl("/market-prices/reliability") +
        buildQueryString({source: source});
      const res = await fetch(url);
      if (!res.ok) throw new Error(`market-reliability HTTP ${res.status}`);
      const data = await res.json();
      return (data.snapshots ?? []) as MarketReliabilitySnapshot[];
    },
    staleTime: 60_000,
  });

/** Operational health from GET /api/market-health. */
export interface MarketHealthSnapshot {
  id: string;
  endpoint: string;
  reliability: MarketReliabilitySnapshot;
}

export const useMarketHealth = () =>
  useQuery<MarketHealthSnapshot[]>({
    queryKey: ["farmer", "marketHealth"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/market-health"));
      if (!res.ok) throw new Error(`market-health HTTP ${res.status}`);
      const data = await res.json();
      return (data.sources ?? []) as MarketHealthSnapshot[];
    },
    staleTime: 60_000,
  });

/** Trigger on-demand ingestion from POST /api/market-prices/refresh. */
export const useRefreshMarketPrices = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      state?: string;
      market?: string;
      commodity?: string;
      arrivalDate?: string;
      includeFallback?: boolean;
    }) => {
      const res = await fetch(apiUrl("/market-prices/refresh"), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`market-refresh HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({queryKey: ["farmer", "marketPrices"]});
      qc.invalidateQueries({queryKey: ["farmer", "allMarketPrices"]});
      qc.invalidateQueries({queryKey: ["farmer", "todayInsight"]});
      qc.invalidateQueries({queryKey: ["farmer", "marketHealth"]});
    },
  });
};

// Buyers.
// =========================================================================
// Transaction hooks. Backed by the real MongoDB API via transaction-api.ts.
// Falls back to the Zustand store / demo data on network failure so the UI
// remains usable when the backend is offline.
// =========================================================================

import {
  fetchBuyers,
  fetchBuyer,
  fetchMyLots,
  fetchLot,
  createLotApi,
  updateLotApi,
  deleteLotApi,
  markLotSoldApi,
  fetchOffersForLot,
  fetchAllOffers,
  updateOfferStatusApi,
  counterOfferApi,
  fetchPayments,
  fetchGrievances,
  createGrievanceApi,
  updateGrievanceApi,
  fetchStorageOptions,
  fetchStorageBookings,
  reserveStorageApi,
  fetchLogisticsOptions,
  bookLogisticsApi,
} from "@/hooks/api/transaction-api";

type OfferStatus = Offer["status"];
type CreateLotPayload = Partial<FarmerLot> & Record<string, unknown>;
type UpdateLotPayload = Record<string, unknown>;
type MarkSoldPayload = Record<string, unknown>;
type GrievanceCreatePayload = Record<string, unknown>;
type StorageReservePayload = Record<string, unknown>;
type LogisticsBookPayload = Record<string, unknown>;

const mapRemoteBuyer = (b: {
  id: string;
  name?: string;
  businessType?: string;
  type?: string;
  cropsInterested?: string[];
  state?: string;
  district?: string;
  [k: string]: unknown;
}): Buyer => ({
  id: b.id,
  name: b.name ?? "",
  type: b.businessType ?? b.type ?? "Trader",
  businessName: b.name ?? "",
  businessType: ((b.businessType as Buyer["businessType"]) ?? "Retailer"),
  verificationStatus: "unverified",
  contactPerson: "",
  phone: "",
  email: "",
  location: [b.district, b.state].filter(Boolean).join(", "),
  state: b.state ?? "",
  district: b.district ?? "",
  distanceKm: 0,
  cropsInterested: b.cropsInterested ?? [],
  minQuantityKg: 0,
  maxQuantityKg: 0,
  paymentTermsDays: 0,
  rating: 0,
  transactionsCount: 0,
  completedDeals: 0,
  description: "",
  verified: false,
  isDemo: false,
});

// --- Buyers -----------------------------------------------------------------

export const useBuyers = (filters?: { state?: string; crop?: string }) =>
  useQuery<Buyer[]>({
    queryKey: ["farmer", "buyers", filters ?? {}],
    queryFn: async () => {
      const remote = await fetchBuyers();
      if (remote && remote.length > 0) {
        let mapped = remote.map(mapRemoteBuyer);
        if (filters?.state)
          mapped = mapped.filter((b) => b.state === filters.state);
        if (filters?.crop)
          mapped = mapped.filter((b) =>
            b.cropsInterested.includes(filters.crop!),
          );
        return mapped;
      }
      let result = [...DEMO_BUYERS];
      if (filters?.state) result = result.filter((b) => b.state === filters.state);
      if (filters?.crop)
        result = result.filter((b) => b.cropsInterested.includes(filters.crop!));
      await delay(140);
      return result;
    },
    staleTime: 60_000,
  });

export const useBuyer = (id: string | undefined) =>
  useQuery<Buyer | null>({
    queryKey: ["farmer", "buyer", id],
    queryFn: async () => {
      if (!id) return null;
      const remote = await fetchBuyer(id);
      if (remote) return mapRemoteBuyer(remote);
      await delay(120);
      return DEMO_BUYERS.find((b) => b.id === id) ?? null;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });

// --- Lots -------------------------------------------------------------------

export const useMyLots = () => {
  const storeLots = useFarmerDashboardStore((s) => s.lots);
  return useQuery<FarmerLot[]>({
    queryKey: ["farmer", "myLots"],
    queryFn: async () => {
      const remote = await fetchMyLots();
      if (remote && remote.length > 0) return remote as FarmerLot[];
      await delay(150);
      return storeLots;
    },
    initialData: storeLots,
    staleTime: 30_000,
  });
};

export const useLot = (id: string | undefined) => {
  const storeLots = useFarmerDashboardStore((s) => s.lots);
  return useQuery<FarmerLot | null>({
    queryKey: ["farmer", "lot", id],
    queryFn: async () => {
      if (!id) return null;
      const remote = await fetchLot(id);
      if (remote) return remote as FarmerLot;
      await delay(120);
      return storeLots.find((l) => l.id === id) ?? null;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
};

export const useCreateLot = () => {
  const qc = useQueryClient();
  const addLot = useFarmerDashboardStore((s) => s.addLot);
  return useMutation<FarmerLot, Error, CreateLotPayload>({
    mutationFn: async (input) => {
      const created = await createLotApi(input as Record<string, unknown>);
      if (created) return created as FarmerLot;
      await delay(180);
      const id = "lot-" + Math.random().toString(36).slice(2, 9);
      const now = new Date().toISOString();
      const lot: FarmerLot = {
        id,
        farmerId: DEMO_FARMER_UID,
        crop: (input.crop as string) ?? "Unknown",
        variety: (input.variety as string) ?? "",
        quantityKg: Number(input.quantityKg ?? 0),
        qualityGrade: ((input.qualityGrade as FarmerLot["qualityGrade"]) ?? "B"),
        qualityNotes: (input.qualityNotes as string) ?? "",
        expectedPricePerKg: Number(input.expectedPricePerKg ?? 0),
        state: (input.state as string) ?? "",
        district: (input.district as string) ?? "",
        village: (input.village as string) ?? "",
        harvestDate: (input.harvestDate as string) ?? now.slice(0, 10),
        images: Array.isArray(input.images) ? (input.images as string[]) : [],
        status: "active",
        createdAt: now,
        isDemo: true,
      };
      addLot(lot);
      return lot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
    },
  });
};

// --- Offers -----------------------------------------------------------------

export const useOffersForLot = (lotId: string | undefined) => {
  const storeOffers = useFarmerDashboardStore((s) => s.offers);
  return useQuery<Offer[]>({
    queryKey: ["farmer", "offers", "lot", lotId],
    queryFn: async () => {
      if (!lotId) return [];
      const remote = await fetchOffersForLot(lotId);
      if (remote && remote.length > 0) return remote as Offer[];
      await delay(120);
      return storeOffers.filter((o) => o.lotId === lotId);
    },
    enabled: Boolean(lotId),
    staleTime: 30_000,
  });
};

export const useAllMyOffers = () => {
  const storeOffers = useFarmerDashboardStore((s) => s.offers);
  return useQuery<Offer[]>({
    queryKey: ["farmer", "offers", "all"],
    queryFn: async () => {
      const remote = await fetchAllOffers();
      if (remote && remote.length > 0) return remote as Offer[];
      await delay(120);
      return storeOffers;
    },
    initialData: storeOffers,
    staleTime: 30_000,
  });
};

export const useUpdateOfferStatus = () => {
  const qc = useQueryClient();
  const updateOffer = useFarmerDashboardStore((s) => s.updateOffer);
  return useMutation<Offer, Error, { offerId: string; status: OfferStatus }>({
    mutationFn: async ({ offerId, status }) => {
      const updated = await updateOfferStatusApi(offerId, status);
      if (updated) return updated as Offer;
      await delay(160);
      updateOffer(offerId, { status });
      const fallback: Offer = {
        id: offerId,
        lotId: "",
        buyerId: "",
        buyerName: "Buyer",
        verified: false,
        pricePerKg: 0,
        offeredPricePerKg: 0,
        amount: 0,
        totalAmount: 0,
        quantityKg: 0,
        validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
        status,
        terms: "",
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
      return fallback;
    },
    onSuccess: (_data, vars) => {
      updateOffer(vars.offerId, { status: vars.status });
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
    },
  });
};

export const useCounterOffer = () => {
  const qc = useQueryClient();
  const updateOffer = useFarmerDashboardStore((s) => s.updateOffer);
  return useMutation<Offer, Error, { offerId: string; pricePerKg: number; terms?: string }>({
    mutationFn: async ({ offerId, pricePerKg, terms }) => {
      const counter = await counterOfferApi(offerId, pricePerKg, terms);
      if (counter) return counter as Offer;
      await delay(180);
      updateOffer(offerId, {
        status: "countered",
        offeredPricePerKg: pricePerKg,
        pricePerKg,
      });
      const fallback: Offer = {
        id: offerId,
        lotId: "",
        buyerId: "",
        buyerName: "Buyer",
        verified: false,
        pricePerKg,
        offeredPricePerKg: pricePerKg,
        amount: 0,
        totalAmount: 0,
        quantityKg: 0,
        validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
        status: "countered",
        terms: terms ?? "",
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
      return fallback;
    },
    onSuccess: (_data, vars) => {
      updateOffer(vars.offerId, {
        status: "countered",
        offeredPricePerKg: vars.pricePerKg,
        pricePerKg: vars.pricePerKg,
      });
      qc.invalidateQueries({ queryKey: ["farmer", "offers"] });
    },
  });
};

// --- Lot mutations ----------------------------------------------------------

export const useUpdateLot = () => {
  const qc = useQueryClient();
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  return useMutation<FarmerLot, Error, { id: string; patch: UpdateLotPayload }>({
    mutationFn: async ({ id, patch }) => {
      const updated = await updateLotApi(id, patch);
      if (updated) return updated as FarmerLot;
      await delay(160);
      updateLot(id, patch as Partial<FarmerLot>);
      const current = useFarmerDashboardStore.getState().lots.find((l) => l.id === id);
      return current ?? ({ id, ...patch } as FarmerLot);
    },
    onSuccess: (_data, vars) => {
      updateLot(vars.id, vars.patch as Partial<FarmerLot>);
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "lot", vars.id] });
    },
  });
};

export const useDeleteLot = () => {
  const qc = useQueryClient();
  const removeLot = useFarmerDashboardStore((s) => s.removeLot);
  return useMutation<boolean, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const ok = await deleteLotApi(id);
      if (!ok) await delay(120);
      removeLot(id);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
    },
  });
};

export const useMarkLotSold = () => {
  const qc = useQueryClient();
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  return useMutation<FarmerLot, Error, { id: string; payload: MarkSoldPayload }>({
    mutationFn: async ({ id, payload }) => {
      const updated = await markLotSoldApi(id, payload);
      if (updated) return updated as FarmerLot;
      await delay(180);
      updateLot(id, { status: "sold", ...(payload as Partial<FarmerLot>) });
      const current = useFarmerDashboardStore.getState().lots.find((l) => l.id === id);
      return current ?? ({ id, ...payload } as FarmerLot);
    },
    onSuccess: (_data, vars) => {
      updateLot(vars.id, { status: "sold", ...(vars.payload as Partial<FarmerLot>) });
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "lot", vars.id] });
      qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
    },
  });
};

// --- Logistics & Storage ----------------------------------------------------

export const useLogisticsOptions = () =>
  useQuery<LogisticsOption[]>({
    queryKey: ["farmer", "logistics", "options"],
    queryFn: async () => {
      const remote = await fetchLogisticsOptions();
      if (remote && remote.length > 0) return remote as LogisticsOption[];
      await delay(140);
      return DEMO_LOGISTICS_OPTIONS;
    },
    initialData: DEMO_LOGISTICS_OPTIONS,
    staleTime: 5 * 60_000,
  });

export const useStorageOptions = () =>
  useQuery<StorageOption[]>({
    queryKey: ["farmer", "storage", "options"],
    queryFn: async () => {
      const remote = await fetchStorageOptions();
      if (remote && remote.length > 0) return remote as StorageOption[];
      await delay(140);
      return DEMO_STORAGE_OPTIONS;
    },
    initialData: DEMO_STORAGE_OPTIONS,
    staleTime: 5 * 60_000,
  });

/**
 * UI-shaped storage list. Adapts the `StorageOption` mocks to the
 * shape expected by `StoragePage` (capacityKg / usedKg, name, location,
 * temperature, "warehouse" | "cold" type label).
 */
export const useStorage = () => {
  const { data: options } = useStorageOptions();
  return useQuery<StorageView[]>({
    queryKey: ["farmer", "storage", "view"],
    queryFn: async () => {
      const remote = await fetchStorageOptions();
      const TONS_TO_KG = 1000;
      const source =
        remote && remote.length > 0
          ? (remote as unknown as StorageOption[])
          : (options ?? DEMO_STORAGE_OPTIONS);
      return source.map<StorageView>((s) => ({
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
};

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
  const addStorageBooking = useFarmerDashboardStore((s) => s.addStorageBooking);
  return useMutation<StorageBooking, Error, ReserveStorageInput>({
    mutationFn: async (input) => {
      const remote = await reserveStorageApi(input as unknown as StorageReservePayload);
      if (remote) return remote as StorageBooking;
      await delay(180);
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
      const remote = await fetchStorageBookings();
      if (remote && remote.length > 0) return remote as StorageBooking[];
      await delay(80);
      return store.storageBookings;
    },
    initialData: store.storageBookings,
    staleTime: 30_000,
  });
};

export const useBookLogistics = () => {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LogisticsBookPayload>({
    mutationFn: async (payload) => {
      const booking = await bookLogisticsApi(payload);
      if (booking) return booking;
      await delay(160);
      return { id: "log-" + Math.random().toString(36).slice(2, 9), ...payload };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "logistics"] });
      qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
    },
  });
};

// --- Payments ---------------------------------------------------------------

export const usePayments = () =>
  useQuery<PaymentRecord[]>({
    queryKey: ["farmer", "payments"],
    queryFn: async () => {
      const remote = await fetchPayments();
      if (remote && remote.length > 0) return remote as PaymentRecord[];
      await delay(140);
      return DEMO_PAYMENTS;
    },
    initialData: DEMO_PAYMENTS,
    staleTime: 30_000,
  });

// --- Grievances -------------------------------------------------------------

export const useGrievances = () => {
  const storeGrievances = useFarmerDashboardStore((s) => s.grievances);
  return useQuery<Grievance[]>({
    queryKey: ["farmer", "grievances"],
    queryFn: async () => {
      const remote = await fetchGrievances();
      if (remote && remote.length > 0) return remote as Grievance[];
      await delay(140);
      return storeGrievances;
    },
    initialData: storeGrievances,
    staleTime: 30_000,
  });
};

export const useCreateGrievance = () => {
  const qc = useQueryClient();
  const addGrievance = useFarmerDashboardStore((s) => s.addGrievance);
  return useMutation<Grievance, Error, GrievanceCreatePayload>({
    mutationFn: async (input) => {
      const created = await createGrievanceApi(input);
      if (created) return created as Grievance;
      await delay(180);
      const id = "gv-" + Math.random().toString(36).slice(2, 9);
      const now = new Date().toISOString();
      const description = String(input.description ?? "");
      const g: Grievance = {
        id,
        raisedBy: "You",
        category: (input.category as Grievance["category"]) ?? "other",
        subject:
          (typeof input.subject === "string" && input.subject.trim()) ||
          (description.length > 60 ? description.slice(0, 57) + "…" : description),
        description,
        priority: (input.priority as Grievance["priority"]) ?? "medium",
        transactionRef: String(input.transactionRef ?? ""),
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

export const useUpdateGrievance = () => {
  const qc = useQueryClient();
  return useMutation<Grievance, Error, { id: string; patch: Record<string, unknown> }>({
    mutationFn: async ({ id, patch }) => {
      const updated = await updateGrievanceApi(id, patch);
      if (updated) return updated as Grievance;
      await delay(160);
      return { id, ...patch } as Grievance;
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


