import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sprout,
  TrendingUp,
  Factory,
  Handshake,
  Truck,
  Plus,
  Wallet,
  Bell,
  ArrowUpRight,
  Store,
  Scale,
  MapPin,
  Calendar,
  Tag,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { useAuthStore } from "@/stores/auth-store";
import {
  useTodayInsight,
  useMyLots,
  useAllMyOffers,
  usePayments,
  useAllMarketPrices,
  useBuyers,
  useGrievances,
  useFarmerProfile,
} from "@/features/farmerDashboard/hooks/data";
import {
  formatKg,
  formatRupees,
  greetingForNow,
} from "@/features/farmerDashboard/hooks/utils";
import {
  recommendBestMarketForLot,
} from "@/features/farmerDashboard/market-intelligence";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import {
  COMMODITIES,
  INDIAN_STATES,
} from "@/features/farmerDashboard/types";
import { ReliabilityChip, LowReliabilityBanner } from "./MarketReliabilityChip";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { to: "/farmer/lots/new", icon: Plus, accent: "emerald", key: "addLot", titleKey: "farmer.lots.new", title: "New Lot", subtitleKey: "farmer.home.addLot", subtitle: "Post fresh crop harvest" },
  { to: "/farmer/prices", icon: TrendingUp, accent: "emerald", key: "marketPrices", titleKey: "farmer.nav.prices", title: "Prices", subtitleKey: "farmer.home.marketPricesHint", subtitle: "Real mandi auction rates" },
  { to: "/farmer/buyers", icon: Factory, accent: "amber", key: "findBuyers", titleKey: "farmer.nav.buyers", title: "Buyers", subtitleKey: "farmer.home.findBuyersHint", subtitle: "Commercial aggregators" },
  { to: "/farmer/lots", icon: Sprout, accent: "rose", key: "myLots", titleKey: "farmer.home.myLots", title: "My Lots", subtitleKey: "farmer.home.myLotsHint", subtitle: "Manage active harvests" },
  { to: "/farmer/offers", icon: Handshake, accent: "sky", key: "myOffers", titleKey: "farmer.nav.offers", title: "Offers", subtitleKey: "farmer.home.myOffersHint", subtitle: "Incoming buyer bids" },
];

export function FarmerHomePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const profile = useFarmerProfile();
  const profileState = (profile.data as any)?.state as string | undefined;
  const profileCrop = ((profile.data as any)?.primaryCrops?.[0] ??
    (profile.data as any)?.primaryCrop) as string | undefined;
  const { data: lots } = useMyLots();
  const { data: offers } = useAllMyOffers();
  const { data: payments } = usePayments();
  const { data: prices } = useAllMarketPrices();
  const { data: grievances } = useGrievances();

  const greeting = greetingForNow();
  const activeLots = lots?.filter((l) => l.status === "active") ?? [];
  const pendingOffers = offers?.filter((o) => o.status === "pending") ?? [];
  const pendingPayments =
    payments?.filter((p) => p.status === "pending") ?? [];
  const topLot = activeLots[0];

  // Dynamic user-selected State & Crop for market insights and buyer discovery
  const [selectedCrop, setSelectedCrop] = useState<string>(() => {
    return topLot?.crop || profileCrop || "Tomato";
  });
  const [selectedState, setSelectedState] = useState<string>(() => {
    return topLot?.state || profileState || "Uttar Pradesh";
  });

  // Sync if profile/lots load after initial render
  useEffect(() => {
    if (topLot?.crop) {
      setSelectedCrop(topLot.crop);
    } else if (profileCrop && selectedCrop === "Tomato") {
      setSelectedCrop(profileCrop);
    }
  }, [topLot?.crop, profileCrop]);

  useEffect(() => {
    if (topLot?.state) {
      setSelectedState(topLot.state);
    } else if (profileState && selectedState === "Uttar Pradesh") {
      setSelectedState(profileState);
    }
  }, [topLot?.state, profileState]);

  // Real backend Market Insight query — updates reactively when user changes crop or state
  const {
    data: insight,
    isLoading: isInsightLoading,
    isFetching: isInsightFetching,
  } = useTodayInsight({
    state: selectedState,
    commodity: selectedCrop,
  });

  // Real backend Buyers query — filtered dynamically by selectedCrop & selectedState
  const {
    data: cropBuyers,
    isLoading: isCropBuyersLoading,
  } = useBuyers({
    crop: selectedCrop,
    state: selectedState,
  });

  // Market intelligence — best-market recommendation for the active lot
  const recommendations = topLot
    ? recommendBestMarketForLot({
        lot: topLot,
        prices: prices ?? [],
        buyers: cropBuyers ?? [],
        grievances: grievances ?? [],
      })
    : [];
  const topRecommendation = recommendations[0];

  function formatRupeesPerKgShort(amount: number): string {
    if (!isFinite(amount)) return "—";
    return "₹ " + amount.toFixed(2);
  }

  return (
    <FarmerPageContainer className="space-y-5 sm:space-y-6">
      {/* Hero Welcome Header */}
      <header className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-5 sm:p-7 shadow-lg shadow-emerald-900/10">
        <p className="text-xs sm:text-sm uppercase tracking-widest text-emerald-100/90 font-semibold">
          {t(`farmer.greeting.${greeting.key}`, greeting.label)}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">
          {user?.name?.split(" ")[0]
            ? `${user.name.split(" ")[0]} 👋`
            : "Farmer 👋"}
        </h1>
        <p className="text-sm sm:text-base text-emerald-50/90 mt-2 max-w-2xl">
          {t(
            "farmer.home.subtitle",
            "Your crop market assistant — discover fair prices, find verified buyers, and track every rupee you earn."
          )}
        </p>
      </header>

      {/* 1. Active Harvest Lot Context Banner / Create Lot Prompt */}
      <FarmerCard className="p-5 sm:p-6 bg-gradient-to-r from-emerald-100/60 via-emerald-50 to-white border border-emerald-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-700/20">
              <Sprout className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                  {t("farmer.home.activeCrop", "Active Harvest Lot")}
                </span>
                {topLot && (
                  <span className="inline-flex items-center rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                    {topLot.crop} • Grade {topLot.qualityGrade}
                  </span>
                )}
              </div>
              <p className="text-base sm:text-lg font-bold text-emerald-950 truncate mt-0.5">
                {topLot
                  ? `${topLot.crop} — ${formatKg(topLot.quantityKg)}`
                  : t("farmer.home.noActiveCrop", "No active crop lot posted")}
              </p>
              <p className="text-xs text-emerald-900/70 truncate">
                {topLot
                  ? `${topLot.district}, ${topLot.state} • Expected ₹${(topLot.expectedPricePerKg * 100).toLocaleString("en-IN")}/quintal`
                  : t("farmer.home.noActiveLot", "Post your harvest lot to unlock buyer bids, fair prices and logistics.")}
              </p>
            </div>
          </div>

          <Link
            to="/farmer/lots/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-5 py-3 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-700/20 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>
              {topLot
                ? t("farmer.home.addAnotherLot", "Add Another Lot")
                : t("farmer.home.createFirstLot", "Create New Lot")}
            </span>
          </Link>
        </div>
      </FarmerCard>

      {/* Soft warning if any active upstream source is degraded */}
      <LowReliabilityBanner />

      {/* 2. Today's Verified Market Insight — User Can Change State & Crop */}
      <FarmerCard className="p-5 sm:p-6 border border-emerald-100/90 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-100/70">
          <div>
            <h2 className="text-base font-bold text-emerald-950 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              {t("farmer.home.todaysInsight", "Today's Verified Market Insight")}
            </h2>
            <p className="text-xs text-emerald-900/60 mt-0.5">
              {t(
                "farmer.home.officialMandiRatesSub",
                "Official mandi rates from Government of India Agmarknet and eNAM registries."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Commodity Selector */}
            <div className="flex items-center gap-1.5 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] font-semibold text-emerald-800">
                {t("farmer.home.cropLabel", "Crop:")}
              </span>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-950 outline-none cursor-pointer"
              >
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* State Selector */}
            <div className="flex items-center gap-1.5 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] font-semibold text-emerald-800">
                {t("farmer.home.stateLabel", "State:")}
              </span>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-950 outline-none cursor-pointer max-w-[150px] truncate"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isInsightLoading || isInsightFetching ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-emerald-800">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">
              {t(
                "farmer.home.fetchingRates",
                "Fetching verified {crop} rates in {state}…",
                { crop: selectedCrop, state: selectedState }
              )}
            </p>
          </div>
        ) : !insight ? (
          <div className="py-6 text-left space-y-2 bg-stone-50/70 p-4 rounded-2xl border border-stone-200/70">
            <div className="flex items-center gap-2 text-emerald-950 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                {t(
                  "farmer.home.noAuctionReported",
                  "No verified mandi auction reported for {crop} in {state} today.",
                  { crop: selectedCrop, state: selectedState }
                )}
              </span>
            </div>
            <p className="text-xs text-emerald-900/60">
              {t(
                "farmer.home.noAuctionHint",
                "Mandis report auctions on active trading days. You can change state/crop above or view historical & multi-mandi records on the Prices page."
              )}
            </p>
            <Link
              to="/farmer/prices"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline pt-1"
            >
              <span>
                {t("farmer.home.explorePricesLink", "Explore all mandis on Prices page")}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                    <Tag className="h-3 w-3" />
                    {t("farmer.home.cropTag", "Crop: {crop}", {
                      crop: insight.commodity || selectedCrop,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    {insight.source ? insight.source.toUpperCase() : "AGMARKNET"}
                  </span>
                  <ReliabilityChip source={insight.source ?? "agmarknet"} />
                </div>

                <div className="flex items-baseline gap-2">
                  <p className="text-3xl sm:text-4xl font-extrabold text-emerald-950">
                    {formatRupees(insight.modalPrice)}
                  </p>
                  <span className="text-sm font-semibold text-emerald-900/70">
                    {t("farmer.home.modalPriceTag", "/quintal (Modal Price)")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-900/80 mt-2">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                    {t("farmer.home.marketTag", "Market: {market}", {
                      market: `${insight.market}${insight.district ? `, ${insight.district}` : ""}${insight.state ? `, ${insight.state}` : ""}`,
                    })}
                  </span>
                  {insight.arrivalDate && (
                    <span className="flex items-center gap-1 text-emerald-900/60">
                      <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                      {t("farmer.home.dateTag", "Date: {date}", {
                        date: insight.arrivalDate,
                      })}
                    </span>
                  )}
                </div>
              </div>

              {insight.minPrice != null && insight.maxPrice != null && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-4 text-xs shrink-0">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-900/60 block">
                      {t("farmer.home.minPrice", "Min Price")}
                    </span>
                    <span className="text-sm font-bold text-emerald-950">{formatRupees(insight.minPrice)}</span>
                  </div>
                  <div className="w-px h-6 bg-emerald-200" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-900/60 block">
                      {t("farmer.home.maxPrice", "Max Price")}
                    </span>
                    <span className="text-sm font-bold text-emerald-950">{formatRupees(insight.maxPrice)}</span>
                  </div>
                </div>
              )}
            </div>

            {insight.recommendation && (
              <p className="text-xs bg-emerald-50 text-emerald-900 rounded-xl p-3 border border-emerald-100">
                💡 {insight.recommendation}
              </p>
            )}
          </div>
        )}
      </FarmerCard>

      {/* 3. Best Market Recommendation for Active Lot */}
      <FarmerCard className="p-5 sm:p-6 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <FarmerSectionTitle
          hint={t(
            "farmer.home.bestMarketHint",
            "Top recommendation calculated from verified mandi prices and distance"
          )}
          action={
            topRecommendation?.price?.source ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                {topRecommendation.price.source.toUpperCase()}
              </span>
            ) : null
          }
        >
          {t("farmer.home.bestMarket", "Best market for your harvest lot")}
        </FarmerSectionTitle>
        {!topLot ? (
          <p className="text-sm text-emerald-900/70 py-2">
            {t(
              "farmer.home.bestMarketNoLot",
              "Create an active lot to see a recommended market."
            )}
          </p>
        ) : !topRecommendation ? (
          <p className="text-sm text-emerald-900/70 py-2">
            {t(
              "farmer.lotDetail.bestMarketsEmpty",
              "No matching mandi data yet."
            )}
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Store className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-emerald-900 truncate">
                  {topRecommendation.price.market}
                </p>
                <p className="text-xs text-emerald-900/70 truncate">
                  {t("farmer.home.bestMarketAt", "at {market} • {distance} km", {
                    market: topRecommendation.price.market,
                    distance: String(topRecommendation.price.distanceKm ?? 0),
                  })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-extrabold text-emerald-900">
                  {formatRupees(topRecommendation.realisable.net)}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
                  {t("farmer.home.bestMarketNet", "Net realisable")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                <Scale className="h-3 w-3" />
                {formatRupeesPerKgShort(topRecommendation.realisable.netPerKg)}/kg
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">
                {t("farmer.home.bestMarketScore", "Match score {score}", {
                  score: String(topRecommendation.score),
                })}
              </span>
              {topRecommendation.price.source ? (
                <span className="text-emerald-900/60">
                  {topRecommendation.price.source}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </FarmerCard>

      {/* 4. Commercial Buyers for Selected Crop */}
      <FarmerCard className="p-5 sm:p-6">
        <FarmerSectionTitle
          hint={t(
            "farmer.home.topBuyersHint",
            `Verified commercial buyers procuring ${selectedCrop}`
          )}
          action={
            <Link
              to="/farmer/buyers"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
            >
              <span>{t("farmer.home.viewAllBuyers", "All Buyers")}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {t("farmer.home.topBuyers", `Commercial Buyers for ${selectedCrop}`)}
        </FarmerSectionTitle>

        {isCropBuyersLoading ? (
          <div className="py-6 text-center text-xs text-emerald-900/60 animate-pulse">
            {t("farmer.home.loadingMatchingBuyers", "Loading matching buyers…")}
          </div>
        ) : !cropBuyers || cropBuyers.length === 0 ? (
          <div className="py-6 text-center text-emerald-900/70 text-xs space-y-1">
            <p>
              {t(
                "farmer.home.noRegionalBuyers",
                "No regional buyers currently registered specifically for {crop} in {state}.",
                { crop: selectedCrop, state: selectedState }
              )}
            </p>
            <Link to="/farmer/buyers" className="inline-block text-emerald-700 font-semibold hover:underline">
              {t("farmer.home.browseAllBuyers", "Browse all buyers across India →")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {cropBuyers.slice(0, 3).map((buyer) => (
              <Link
                key={buyer.id}
                to="/farmer/buyers/$buyerId"
                params={{ buyerId: buyer.id }}
                className="flex flex-col justify-between rounded-xl border border-emerald-100 p-3.5 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all active:scale-[0.98] bg-white shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                      {buyer.businessType || t("farmer.home.buyerTypeDefault", "Buyer")}
                    </span>
                    {buyer.verificationStatus === "verified" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-700 font-semibold">
                        <ShieldCheck className="h-3 w-3" />
                        {t("farmer.home.verifiedBadge", "Verified")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-emerald-950 truncate mt-2">
                    {buyer.name}
                  </p>
                  <p className="text-xs text-emerald-900/60 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-emerald-700" />
                    {buyer.district ? `${buyer.district}, ` : ""}{buyer.state}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {buyer.cropsInterested.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          c.toLowerCase() === selectedCrop.toLowerCase()
                            ? "bg-emerald-200/80 text-emerald-900 font-bold"
                            : "bg-emerald-50 text-emerald-800"
                        )}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-emerald-50 flex items-center justify-between text-xs">
                  <span className="text-emerald-900/60 text-[11px]">
                    ⭐ {buyer.rating.toFixed(1)} ({buyer.completedDeals} {t("farmer.home.dealsFulfilled", "deals fulfilled")})
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px] hover:underline">
                    {t("farmer.home.viewAndOffer", "View & Offer →")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </FarmerCard>

      {/* 5. Quick Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={cn(
              "group rounded-2xl border border-emerald-100/80 bg-white p-4 hover:shadow-md transition-all flex flex-col gap-2",
              "active:scale-[0.98]"
            )}
          >
            <span
              className={cn(
                "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center",
                a.accent === "emerald" && "bg-emerald-100 text-emerald-700",
                a.accent === "amber" && "bg-amber-100 text-amber-700",
                a.accent === "rose" && "bg-rose-100 text-rose-700",
                a.accent === "sky" && "bg-sky-100 text-sky-700"
              )}
            >
              <a.icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div>
              <p className="text-sm sm:text-base font-bold text-emerald-900">
                {t(a.titleKey, a.title)}
              </p>
              <p className="text-xs text-emerald-900/60 mt-0.5">
                {a.key === "myLots"
                  ? `${activeLots.length} ${t("farmer.home.active", "active")}`
                  : a.key === "myOffers"
                  ? `${pendingOffers.length} ${t("farmer.home.pending", "pending")}`
                  : t(a.subtitleKey, a.subtitle)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* 6. Operations Links: Grievances, Payments, Logistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Link
          to="/farmer/grievances"
          className="rounded-2xl border border-emerald-100/80 bg-white p-4 hover:shadow-md transition-all flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-900">
              {t("farmer.home.grievances", "Grievances")}
            </p>
            <p className="text-xs text-emerald-900/60 truncate">
              {t("farmer.home.grievancesHint", "Raise and track disputes")}
            </p>
          </div>
        </Link>
        <Link
          to="/farmer/payments"
          className="rounded-2xl border border-emerald-100/80 bg-white p-4 hover:shadow-md transition-all flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-900">
              {t("farmer.home.payments", "Payments")}
            </p>
            <p className="text-xs text-emerald-900/60 truncate">
              {pendingPayments.length > 0
                ? `${pendingPayments.length} ${t("farmer.home.pending", "pending")}`
                : t("farmer.home.paymentsUpToDate", "All up to date")}
            </p>
          </div>
        </Link>
        <Link
          to="/farmer/logistics"
          className="rounded-2xl border border-emerald-100/80 bg-white p-4 hover:shadow-md transition-all flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-900">
              {t("farmer.home.logistics", "Logistics & Storage")}
            </p>
            <p className="text-xs text-emerald-900/60 truncate">
              {t(
                "farmer.home.logisticsHint",
                "Transport, cold storage & warehousing"
              )}
            </p>
          </div>
        </Link>
      </div>
    </FarmerPageContainer>
  );
}
