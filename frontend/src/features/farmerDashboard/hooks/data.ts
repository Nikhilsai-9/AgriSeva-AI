/**
 * Farmer Dashboard data hooks — Part 1 (store + core queries).
 *
 * All hooks are wired to the real MongoDB-backed backend. There is
 * no silent fall-back to in-memory demo data on empty / failed
 * responses — every query returns what the backend said, even if that
 * is an empty list. The UI renders explicit empty states in that case.
 *
 * The only demo fixture still in active use is `market-prices.mock.ts`,
 * which is consumed by `useMarketPrices` when the backend explicitly
 * reports `isDemo: true` (i.e. the live Agmarknet / eNAM MCP sources
 * are unreachable). See `MarketPricesPage` for the surfaced badge.
 *
 * The Zustand store below is initialized empty: every mutation goes
 * through the backend, and the cache invalidation in `onSuccess`
 * refetches the source of truth.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { create } from "zustand";

import {
  buildDemoMarketPriceResponse,
  DEMO_MARKET_PRICES,
  DEMO_TODAY_INSIGHT,
} from "../mocks/market-prices.mock";
import { env } from "@/config/env";
import { apiFetch } from "@/hooks/api/api-fetch";

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
    // Initialized empty: every collection is owned by the backend and
    // is populated via React Query hooks (`useMyLots`, `useAllMyOffers`,
    // `useGrievances`, `useStorageBookings`, `useNotifications`).
    lots: [],
    offers: [],
    grievances: [],
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
      // Strict: backend is the single source of truth for profile data.
      // On error, the query enters `isError` state and the UI shows a
      // "Could not load profile" message instead of silently showing
      // the demo farmer's profile.
      const remote = await fetchMyProfile();
      if (!remote) {
        throw new Error("Profile not available");
      }
      return remote;
    },
    staleTime: 60_000,
  });

export interface FarmerProfilePatch {
  // `name` lives on `IUser` (not in the farmerProfile sub-doc). We keep
  // it here for backwards-compat with the existing ProfilePage form,
  // but it is silently ignored by the backend endpoint (callers should
  // split it into firstName/lastName via a separate IUser update).
  name?: string;
  phone?: string;
  state?: string;
  district?: string;
  village?: string;
  preferredLanguage?: string;
  /** Shortcut: persisted into `primaryCrops` as a new first entry. */
  primaryCrop?: string;
  /** Direct array — for callers that already have the full list. */
  primaryCrops?: string[];
  preferredMarkets?: string[];
  fpoMember?: boolean;
  fpoName?: string;
  landSizeAcres?: number;
  experienceYears?: number;
}

export const useUpdateFarmerProfile = () => {
  const qc = useQueryClient();
  return useMutation<FarmerProfile, Error, FarmerProfilePatch>({
    mutationFn: async (patch) => {
      // Translate shortcut fields.
      const backendPatch: Partial<FarmerProfile> = {
        ...patch,
      };
      if (patch.primaryCrop !== undefined) {
        const current =
          qc.getQueryData<FarmerProfile>(["farmer", "profile"]);
        if (!current) {
          throw new Error("Profile not loaded yet");
        }
        const merged = [
          patch.primaryCrop,
          ...current.primaryCrops.filter((c) => c !== patch.primaryCrop),
        ];
        backendPatch.primaryCrops = merged;
        delete (backendPatch as Record<string, unknown>).primaryCrop;
      }

      // `name` lives on the IUser document (not the farmerProfile
      // sub-doc), so route it through `PUT /api/users` with
      // `firstName` / `lastName`. The farmerProfile patch below
      // intentionally does not include `name`.
      const { name, ...farmerProfilePatch } =
        backendPatch as FarmerProfilePatch;

      let updatedProfile: FarmerProfile | null = null;

      // 1) Patch the farmerProfile sub-doc (phone, location, crops, ...).
      const profileRes = await patchMyProfile(farmerProfilePatch);
      if (!profileRes) {
        throw new Error("Could not save profile");
      }
      updatedProfile = profileRes;

      // 2) If the name changed, also PATCH the IUser document via the
      //    dedicated edit endpoint (UpdateUserDto: firstName / lastName).
      const trimmedName = (name ?? "").trim();
      if (trimmedName) {
        const space = trimmedName.indexOf(" ");
        const firstName =
          space === -1 ? trimmedName : trimmedName.slice(0, space);
        const lastName = space === -1 ? "" : trimmedName.slice(space + 1);
        const userRes = await updateMyName(firstName, lastName);
        if (userRes) {
          updatedProfile = userRes;
        }
      }

      return updatedProfile;
    },
    onSuccess: (data) => {
      qc.setQueryData(["farmer", "profile"], data);
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
    /**
     * PHASE 1 §P1.2 — provenance flag. True when the row is a state-level
     * roll-up (no real mandi name on the upstream dashboard response).
     * UI surfaces a `(state aggregate)` hint so it's never confused with a
     * real per-mandi price. Absent for genuine per-mandi rows.
     */
    isAggregate?: boolean;
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
  isAggregate: r.isAggregate,
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
      // Only fall back to the documented demo dataset when the backend
      // EXPLICITLY reports `isDemo: true` (e.g. Agmarknet / eNAM MCP
      // unreachable). An empty `prices` array is left empty so the UI can
      // render an honest "No market data for this filter" state, instead
      // of masking it as demo and lying about the source.
      if (data.isDemo) {
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
      // Only fall back to demo when the backend explicitly reports
      // `isDemo: true` (e.g. Agmarknet / eNAM MCP unreachable). An
      // empty `prices` array is left empty so the UI can render an
      // honest "No market data for this filter" state.
      if (data.isDemo) return DEMO_MARKET_PRICES;
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
      // Only fall back to demo when the backend explicitly reports
      // `isDemo: true`. A null `insight` is returned as null so the
      // home page can render an honest "No insight yet for today".
      if (data.isDemo) return DEMO_TODAY_INSIGHT;
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
type GrievanceCreatePayload = Record<string, unknown>;
type StorageReservePayload = Record<string, unknown>;
type LogisticsBookPayload = Record<string, unknown>;

/**
 * PHASE 3 §P3.A — honest data-state classification for any list of records
 * carrying an `isDemo: boolean` field. The Farmer Dashboard used to show
 * a static "Demo" badge on Buyers / Payments / Storage / Logistics pages
 * regardless of whether the actual records were demo or real. That was
 * misleading once a real farmer had signed in and started creating real
 * lots: their real records were labelled demo.
 *
 * The classification lives in `./../dataState.ts` so it can be unit-tested
 * in isolation (no React/Query/MSW/Zustand dependencies). This module
 * re-exports it for backwards compatibility with existing call sites.
 */
export {classifyDemoState, type DemoDataState} from "../dataState";

const mapRemoteBuyer = (b: {
  id: string;
  name?: string;
  businessType?: string;
  type?: string;
  cropsInterested?: string[];
  state?: string;
  district?: string;
  isDemo?: boolean;
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
  // PHASE 3 §P3.A — propagate the backend's isDemo flag so the
  // BuyersListPage can render a truthful Demo / Live badge based on the
  // actual record provenance, not a static hardcoded badge.
  isDemo: Boolean(b.isDemo),
});

// --- Buyers -----------------------------------------------------------------

export const useBuyers = (filters?: { state?: string; crop?: string }) =>
  useQuery<Buyer[]>({
    queryKey: ["farmer", "buyers", filters ?? {}],
    queryFn: async () => {
      // Strict: backend is the source of truth. Empty result → empty UI;
      // network failure → query enters isError and the page renders the
      // error state instead of silently showing demo buyers.
      const remote = await fetchBuyers();
      let mapped = remote.map(mapRemoteBuyer);
      if (filters?.state)
        mapped = mapped.filter((b) => b.state === filters.state);
      if (filters?.crop)
        mapped = mapped.filter((b) =>
          b.cropsInterested.includes(filters.crop!),
        );
      return mapped;
    },
    staleTime: 60_000,
  });

export const useBuyer = (id: string | undefined) =>
  useQuery<Buyer | null>({
    queryKey: ["farmer", "buyer", id],
    queryFn: async () => {
      if (!id) return null;
      const remote = await fetchBuyer(id);
      if (!remote) return null;
      return mapRemoteBuyer(remote);
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });

// --- Lots -------------------------------------------------------------------

export const useMyLots = () =>
  useQuery<FarmerLot[]>({
    queryKey: ["farmer", "myLots"],
    queryFn: async () => {
      // Strict: backend is the source of truth. Empty result → empty UI;
      // network failure → query enters isError and the page renders the
      // error state instead of silently showing demo lots.
      const remote = await fetchMyLots();
      return remote as FarmerLot[];
    },
    staleTime: 30_000,
  });

export const useLot = (id: string | undefined) =>
  useQuery<FarmerLot | null>({
    queryKey: ["farmer", "lot", id],
    queryFn: async () => {
      if (!id) return null;
      const remote = await fetchLot(id);
      if (!remote) return null;
      return remote as FarmerLot;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

export const useCreateLot = () => {
  const qc = useQueryClient();
  return useMutation<FarmerLot, Error, CreateLotPayload>({
    mutationFn: async (input) => {
      const created = await createLotApi(input as Record<string, unknown>);
      if (!created) {
        throw new Error("Could not create lot");
      }
      return created as FarmerLot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
    },
  });
};

// --- Offers -----------------------------------------------------------------

export const useOffersForLot = (lotId: string | undefined) =>
  useQuery<Offer[]>({
    queryKey: ["farmer", "offers", "lot", lotId],
    queryFn: async () => {
      if (!lotId) return [];
      const remote = await fetchOffersForLot(lotId);
      return remote as Offer[];
    },
    enabled: Boolean(lotId),
    staleTime: 30_000,
  });

export const useAllMyOffers = () =>
  useQuery<Offer[]>({
    queryKey: ["farmer", "offers", "all"],
    queryFn: async () => {
      const remote = await fetchAllOffers();
      return remote as Offer[];
    },
    staleTime: 30_000,
  });

export const useUpdateOfferStatus = () => {
  const qc = useQueryClient();
  const updateOffer = useFarmerDashboardStore((s) => s.updateOffer);
  return useMutation<Offer, Error, { offerId: string; status: OfferStatus }>({
    mutationFn: async ({ offerId, status }) => {
      const updated = await updateOfferStatusApi(offerId, status);
      if (!updated) {
        throw new Error("Could not update offer");
      }
      return updated as Offer;
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
  return useMutation<
    Offer,
    Error,
    { offerId: string; pricePerKg: number; message?: string }
  >({
    mutationFn: async ({ offerId, pricePerKg, message }) => {
      const counter = await counterOfferApi(offerId, pricePerKg, message);
      if (!counter) {
        throw new Error("Could not counter offer");
      }
      return counter as Offer;
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
      if (!updated) {
        throw new Error("Could not update lot");
      }
      return updated as FarmerLot;
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
      if (!ok) {
        throw new Error("Could not delete lot");
      }
      return true;
    },
    onSuccess: (_data, vars) => {
      // Optimistic store mirror so the card disappears instantly;
      // the cache invalidation below then refetches the source of
      // truth.
      removeLot(vars.id);
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "lot", vars.id] });
    },
  });
};

export const useMarkLotSold = () => {
  const qc = useQueryClient();
  const updateLot = useFarmerDashboardStore((s) => s.updateLot);
  return useMutation<
    FarmerLot,
    Error,
    {
      id: string;
      finalPricePerKg: number;
      buyerName?: string;
      buyerId?: string;
    }
  >({
    mutationFn: async ({ id, finalPricePerKg, buyerName, buyerId }) => {
      const updated = await markLotSoldApi(id, {
        finalPricePerKg,
        buyerName,
        buyerId,
      });
      if (!updated) {
        throw new Error("Could not mark lot as sold");
      }
      return updated as FarmerLot;
    },
    onSuccess: (_data, vars) => {
      // Optimistic local mirror — the cache invalidation below then
      // refetches the source of truth with the real sold-state lot.
      updateLot(vars.id, { status: "sold" });
      qc.invalidateQueries({ queryKey: ["farmer", "myLots"] });
      qc.invalidateQueries({ queryKey: ["farmer", "lot", vars.id] });
      qc.invalidateQueries({ queryKey: ["farmer", "payments"] });
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
      return remote as LogisticsOption[];
    },
    staleTime: 5 * 60_000,
  });

export const useStorageOptions = () =>
  useQuery<StorageOption[]>({
    queryKey: ["farmer", "storage", "options"],
    queryFn: async () => {
      const remote = await fetchStorageOptions();
      return remote as StorageOption[];
    },
    staleTime: 5 * 60_000,
  });

/**
 * UI-shaped storage list. Adapts the backend `StorageOption` to the
 * shape expected by `StoragePage` (capacityKg / usedKg, name, location,
 * temperature, "warehouse" | "cold" type label).
 *
 * No silent demo fallback: empty / failed `useStorageOptions` result
 * propagates as an empty list, and `StoragePage` renders its built-in
 * empty state.
 */
export const useStorage = () => {
  const { data: options } = useStorageOptions();
  return useQuery<StorageView[]>({
    queryKey: ["farmer", "storage", "view"],
    queryFn: async () => {
      const remote = await fetchStorageOptions();
      const TONS_TO_KG = 1000;
      const source = (remote && remote.length > 0
        ? (remote as unknown as StorageOption[])
        : (options ?? [])) as StorageOption[];
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
  return useMutation<StorageBooking, Error, ReserveStorageInput>({
    mutationFn: async (input) => {
      const remote = await reserveStorageApi(input as unknown as StorageReservePayload);
      if (!remote) {
        throw new Error("Could not reserve storage");
      }
      return remote as StorageBooking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "storage"] });
      qc.invalidateQueries({ queryKey: ["farmer", "storageBookings"] });
      qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
    },
  });
};

export const useStorageBookings = () =>
  useQuery<StorageBooking[]>({
    queryKey: ["farmer", "storageBookings"],
    queryFn: async () => {
      const remote = await fetchStorageBookings();
      return remote as StorageBooking[];
    },
    staleTime: 30_000,
  });

export const useBookLogistics = () => {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LogisticsBookPayload>({
    mutationFn: async (payload) => {
      const booking = await bookLogisticsApi(payload);
      if (!booking) {
        throw new Error("Could not book logistics");
      }
      return booking;
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
      return remote as PaymentRecord[];
    },
    staleTime: 30_000,
  });

// --- Grievances -------------------------------------------------------------

export const useGrievances = () =>
  useQuery<Grievance[]>({
    queryKey: ["farmer", "grievances"],
    queryFn: async () => {
      const remote = await fetchGrievances();
      return remote as Grievance[];
    },
    staleTime: 30_000,
  });

export const useCreateGrievance = () => {
  const qc = useQueryClient();
  return useMutation<Grievance, Error, GrievanceCreatePayload>({
    mutationFn: async (input) => {
      const created = await createGrievanceApi(input);
      if (!created) {
        throw new Error("Could not file grievance");
      }
      return created as Grievance;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "grievances"] });
      qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
    },
  });
};

export const useUpdateGrievance = () => {
  const qc = useQueryClient();
  return useMutation<Grievance, Error, { id: string; patch: Record<string, unknown> }>({
    mutationFn: async ({ id, patch }) => {
      const updated = await updateGrievanceApi(id, patch);
      if (!updated) {
        throw new Error("Could not update grievance");
      }
      return updated as Grievance;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmer", "grievances"] });
    },
  });
};


// ──────────────────────────────────────────────────────────────────────
// Real-backend adapter helpers.
// These wrap `apiFetch` (Firebase-token aware) and project the
// canonical Mongo / routing-controllers shapes onto the frontend
// `FarmerProfile` / `NotificationItem` types. The dashboard keeps
// working when the backend is offline because every helper returns
// `null` / a sensible fallback rather than throwing.
// ──────────────────────────────────────────────────────────────────────

/** Backend `IUser` shape (subset we care about for the profile). */
interface BackendUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  role?: string;
  farmerProfile?: {
    phone?: string;
    state?: string;
    district?: string;
    village?: string;
    primaryCrops?: string[];
    preferredMarkets?: string[];
    fpoMember?: boolean;
    fpoName?: string;
    landSizeAcres?: number;
    experienceYears?: number;
    preferredLanguage?: string;
    joinedAt?: string;
    verificationStatus?: 'verified' | 'pending' | 'unverified';
    isDemo?: boolean;
  };
}

const buildApiUrl = (path: string): string => {
  const base = (env.apiBaseUrl() ?? '').replace(/\/+$/, "");
  const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path.startsWith('/') ? path : '/' + path;
  return `${base}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
};

/** Project an `IUser` from the backend onto the UI's `FarmerProfile`. */
function userToProfile(user: BackendUser): FarmerProfile {
  const fp = user.farmerProfile ?? {};
  const name = [user.firstName ?? "", user.lastName ?? ""]
    .join(" ")
    .trim();
  return {
    uid: user._id ?? "",
    name: name || (user.email ?? "Farmer"),
    email: user.email ?? "",
    phone: fp.phone ?? user.mobile ?? "",
    state: fp.state ?? "",
    district: fp.district ?? "",
    village: fp.village ?? "",
    preferredLanguage: fp.preferredLanguage ?? "en-IN",
    primaryCrops: fp.primaryCrops ?? [],
    preferredMarkets: fp.preferredMarkets ?? [],
    fpoName: fp.fpoName ?? "",
    fpoMember: fp.fpoMember ?? false,
    landSizeAcres: fp.landSizeAcres ?? 0,
    joinedAt: fp.joinedAt ?? new Date().toISOString(),
    verificationStatus: fp.verificationStatus ?? "unverified",
    isDemo: fp.isDemo ?? false,
  };
}

/** Backend `INotification` shape returned by `/api/notifications`. */
interface BackendNotification {
  _id?: string;
  enitity_id?: string;
  title?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  createdAt?: string;
}

/** Project a backend notification onto the UI's `NotificationItem`. */
function notificationToItem(n: BackendNotification): NotificationItem {
  // Map backend type strings to UI "kind" buckets.
  const t = (n.type ?? "").toLowerCase();
  const kind: NotificationItem["kind"] = t.startsWith("offer")
    ? "offer"
    : t.startsWith("payment")
      ? "payment"
      : t.startsWith("grievance")
        ? "grievance"
        : t.startsWith("lot")
          ? "lot"
          : "system";
  const id = n._id ?? n.enitity_id ?? cryptoLikeId();
  const href = kind === "offer" || kind === "lot"
    ? `/farmer/notifications`
    : `/farmer/notifications`;
  return {
    id,
    kind,
    title: n.title ?? (kind === "system" ? "Notification" : kind),
    body: n.message ?? "",
    href,
    read: Boolean(n.is_read),
    createdAt: n.createdAt ?? new Date().toISOString(),
  };
}

function cryptoLikeId(): string {
  return "n-" + Math.random().toString(36).slice(2, 10);
}

async function fetchMyNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await apiFetch<{
      success: boolean;
      notifications: BackendNotification[];
    }>(buildApiUrl("/api/notifications?page=1&limit=25"));
    const items = (res?.notifications ?? []).map(notificationToItem);
    return items.filter((i) => i.id);
  } catch (err) {
    console.warn("[data.ts] notifications fetch failed", err);
    return [];
  }
}

async function fetchMyProfile(): Promise<FarmerProfile | null> {
  try {
    const res = await apiFetch<BackendUser>(buildApiUrl("/api/users/me"));
    if (!res || !res._id) return null;
    return userToProfile(res);
  } catch (err) {
    console.warn("[data.ts] profile fetch failed", err);
    return null;
  }
}

async function patchMyProfile(
  patch: Partial<FarmerProfile>,
): Promise<FarmerProfile | null> {
  try {
    // Translate the UI patch shape to the backend DTO.
    const body: Record<string, unknown> = {};
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.state !== undefined) body.state = patch.state;
    if (patch.district !== undefined) body.district = patch.district;
    if (patch.village !== undefined) body.village = patch.village;
    if (patch.preferredLanguage !== undefined)
      body.preferredLanguage = patch.preferredLanguage;
    if (patch.primaryCrops !== undefined) body.primaryCrops = patch.primaryCrops;
    if (patch.preferredMarkets !== undefined)
      body.preferredMarkets = patch.preferredMarkets;
    if (patch.fpoMember !== undefined) body.fpoMember = patch.fpoMember;
    if (patch.fpoName !== undefined) body.fpoName = patch.fpoName;
    if (patch.landSizeAcres !== undefined)
      body.landSizeAcres = patch.landSizeAcres;
    if (patch.experienceYears !== undefined)
      body.experienceYears = patch.experienceYears;

    const res = await apiFetch<BackendUser>(buildApiUrl("/api/users/me/farmer-profile"), {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
    if (!res || !res._id) return null;
    return userToProfile(res);
  } catch (err) {
    console.warn("[data.ts] profile patch failed", err);
    return null;
  }
}

/**
 * Update the authenticated user's `firstName` / `lastName` via
 * `PUT /api/users` (UpdateUserDto on the backend). Returns the
 * projected `FarmerProfile` on success, or `null` if the request
 * failed / the response was empty.
 *
 * The `name` field on the legacy `FarmerProfile` UI shape is derived
 * from `firstName + " " + lastName` in `userToProfile`, so splitting
 * the form value here keeps the bell, home greeting, and sidebar in
 * sync with what the user typed.
 */
async function updateMyName(
  firstName: string,
  lastName: string,
): Promise<FarmerProfile | null> {
  try {
    const body: Record<string, unknown> = { firstName };
    if (lastName) body.lastName = lastName;
    const res = await apiFetch<BackendUser>(buildApiUrl("/api/users"), {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
    if (!res || !res._id) return null;
    return userToProfile(res);
  } catch (err) {
    console.warn("[data.ts] name update failed", err);
    return null;
  }
}

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

// Notifications feed.
//
// Pure pass-through to `GET /api/notifications`. The backend
// `NotificationService` fires real `saveTheNotifications(...)` calls
// from `LotController.markSold`, `OfferController.transition`,
// `PaymentController.{create,update}`, `GrievanceController.{create,
// update}`, `StorageController.createBooking`, and
// `LogisticsController.createBooking`, so the bell mirrors backend
// truth. No more in-memory synthesised items derived from the store —
// they were the original source of the "phantom notifications" bug.
export const useNotifications = () =>
  useQuery<NotificationItem[]>({
    queryKey: ["farmer", "notifications"],
    queryFn: async () => {
      const remote = await fetchMyNotifications();
      return remote;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return async (id: string) => {
    // Best-effort PATCH — never throw to the caller.
    try {
      await apiFetch(buildApiUrl(`/api/notifications/${id}`), {
        method: "PATCH",
      });
    } catch (err) {
      console.warn(`[data.ts] markNotificationRead ${id} failed`, err);
    }
    qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
  };
};

export const useMarkAllNotificationsRead = () => {
  const markAll = useFarmerDashboardStore(
    (s) => s.markAllNotificationsRead,
  );
  const qc = useQueryClient();
  return async () => {
    // Local mirror first so the UI is instant.
    markAll();
    try {
      await apiFetch(buildApiUrl("/api/notifications"), {method: "PATCH"});
    } catch (err) {
      console.warn("[data.ts] markAllNotificationsRead failed", err);
    }
    qc.invalidateQueries({ queryKey: ["farmer", "notifications"] });
  };
};


