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
  Star,
  Scale,
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
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { to: "/farmer/prices", icon: TrendingUp, accent: "emerald", key: "marketPrices" },
  { to: "/farmer/buyers", icon: Factory, accent: "amber", key: "findBuyers" },
  { to: "/farmer/lots", icon: Sprout, accent: "rose", key: "myLots" },
  { to: "/farmer/offers", icon: Handshake, accent: "sky", key: "myOffers" },
];

export function FarmerHomePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: insight } = useTodayInsight();
  const { data: lots } = useMyLots();
  const { data: offers } = useAllMyOffers();
  const { data: payments } = usePayments();
  const { data: prices } = useAllMarketPrices();
  const { data: buyers } = useBuyers();
  const { data: grievances } = useGrievances();

  const greeting = greetingForNow();
  const activeLots = lots?.filter((l) => l.status === "active") ?? [];
  const pendingOffers = offers?.filter((o) => o.status === "pending") ?? [];
  const pendingPayments =
    payments?.filter((p) => p.status === "pending") ?? [];
  const topLot = activeLots[0];

  // Market intelligence — best-market + top-3 buyers for the active lot.
  const recommendations = topLot
    ? recommendBestMarketForLot({
        lot: topLot,
        prices: prices ?? [],
        buyers: buyers ?? [],
        grievances: grievances ?? [],
      })
    : [];
  const topRecommendation = recommendations[0];
  const top3Buyers = (buyers ?? [])
    .map((b) => ({ buyer: b }))
    .slice(0, 3);

  // Local helper for compact ₹/kg display.
  function formatRupeesPerKgShort(amount: number): string {
    if (!isFinite(amount)) return "—";
    return "₹ " + amount.toFixed(2);
  }

  return (
    <FarmerPageContainer className="space-y-5 sm:space-y-6">
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

      <FarmerCard className="p-5 sm:p-6 bg-gradient-to-br from-amber-50 to-white">
        <FarmerSectionTitle
          hint={t(
            "farmer.home.primaryCropHint",
            "Your most recently created active lot."
          )}
        >
          {t("farmer.home.yourCrop", "Your Crop")}
        </FarmerSectionTitle>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Sprout className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg sm:text-xl font-bold text-emerald-900 truncate">
              {topLot?.crop ?? t("farmer.home.noCrop", "No active crop yet")}
            </p>
            <p className="text-xs sm:text-sm text-emerald-900/70 truncate">
              {topLot
                ? `${formatKg(topLot.quantityKg)} • Grade ${topLot.qualityGrade} • ${topLot.district}, ${topLot.state}`
                : t(
                    "farmer.home.noActiveLot",
                    "Create your first lot to start receiving offers."
                  )}
            </p>
          </div>
          <Link
            to="/farmer/lots/new"
            className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 sm:gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shrink-0"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">
              {t("farmer.home.addLot", "Add Lot")}
            </span>
          </Link>
        </div>
      </FarmerCard>

      {/* Best market recommendation card — market intelligence */}
      <FarmerCard className="p-5 sm:p-6 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <FarmerSectionTitle
          hint={t(
            "farmer.home.bestMarketHint",
            "Top recommendation based on price, distance, demand & reliability"
          )}
          action={
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              {t("farmer.common.sourceDemo", "Demo")}
            </span>
          }
        >
          {t("farmer.home.bestMarket", "Best market for your crop")}
        </FarmerSectionTitle>
        {!topLot ? (
          <p className="text-sm text-emerald-900/70">
            {t(
              "farmer.home.bestMarketNoLot",
              "Create an active lot to see a recommended market."
            )}
          </p>
        ) : !topRecommendation ? (
          <p className="text-sm text-emerald-900/70">
            {t(
              "farmer.lotDetail.bestMarketsEmpty",
              "No matching mandi data yet."
            )}
          </p>
        ) : (
          <div className="space-y-3">
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
                {formatRupeesPerKgShort(
                  topRecommendation.realisable.netPerKg
                )}
                /kg
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

      {/* Top 3 matched buyers — market intelligence */}
      {topLot && top3Buyers.length > 0 ? (
        <FarmerCard className="p-5 sm:p-6">
          <FarmerSectionTitle
            hint={t(
              "farmer.home.topBuyersHint",
              "Best buyers for your active lot"
            )}
          >
            {t("farmer.home.topBuyers", "Top matched buyers")}
          </FarmerSectionTitle>
          <div className="space-y-2">
            {top3Buyers.map(({ buyer }) => (
              <Link
                key={buyer.id}
                to="/farmer/buyers/$buyerId"
                params={{ buyerId: buyer.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 p-3 hover:bg-emerald-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Factory className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate">
                      {buyer.name}
                    </p>
                    <p className="text-xs text-emerald-900/60 truncate">
                      <Star className="inline h-3 w-3 text-amber-500 mr-1" />
                      {buyer.rating.toFixed(1)} • {buyer.completedDeals}{" "}
                      {t("farmer.buyers.deals", "deals")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 px-2 py-1 shrink-0">
                  {t("farmer.home.viewBuyer", "View buyer")}
                </span>
              </Link>
            ))}
          </div>
        </FarmerCard>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={cn(
              "group rounded-2xl border border-emerald-100/80 bg-white p-4 sm:p-5 hover:shadow-md transition-all flex flex-col gap-2 sm:gap-3",
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
                {t(`farmer.home.${a.key}`, a.key)}
              </p>
              <p className="text-xs text-emerald-900/60 mt-0.5">
                {a.key === "myLots"
                  ? `${activeLots.length} ${t("farmer.home.active", "active")}`
                  : a.key === "myOffers"
                    ? `${pendingOffers.length} ${t("farmer.home.pending", "pending")}`
                    : t(`farmer.home.${a.key}Hint`, "")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <FarmerCard className="p-5 sm:p-6">
        <FarmerSectionTitle
          hint={t(
            "farmer.home.insightHint",
            "Aggregated from connected mandi sources (demo data)."
          )}
          action={
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Demo
            </span>
          }
        >
          {t("farmer.home.todaysInsight", "Today's Market Insight")}
        </FarmerSectionTitle>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-emerald-900">
              {formatRupees(insight?.modalPrice ?? 2450)}
              <span className="text-base sm:text-lg font-semibold text-emerald-900/70 ml-1">
                /{insight?.unit ?? "quintal"}
              </span>
            </p>
            <p className="text-sm text-emerald-900/70 mt-1">
              {insight?.crop ?? "Tomato"} • {insight?.market ?? "Azadpur Mandi"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full text-sm">
              <ArrowUpRight className="h-4 w-4" />
              {insight?.changePct != null
                ? `${insight.changePct >= 0 ? "+" : ""}${insight.changePct.toFixed(1)}%`
                : "+3.2%"}
            </span>
            <span className="text-xs text-emerald-900/60">
              {t("farmer.home.vsYesterday", "vs yesterday")}
            </span>
          </div>
        </div>
        {insight?.recommendation && (
          <p className="mt-4 text-sm bg-emerald-50 text-emerald-900 rounded-xl p-3">
            💡 {insight.recommendation}
          </p>
        )}
      </FarmerCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Link
          to="/farmer/grievances"
          className="rounded-2xl border border-emerald-100/80 bg-white p-4 hover:shadow-md transition-all flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
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
          <span className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
          <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
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

