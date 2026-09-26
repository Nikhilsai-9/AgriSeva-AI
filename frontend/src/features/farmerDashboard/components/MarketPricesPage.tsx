import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MapPin,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useMarketPrices,
  useRefreshMarketPrices,
  type MarketPriceQuery,
} from "@/features/farmerDashboard/hooks/data";
import {
  COMMODITIES,
  INDIAN_STATES,
  type MarketPrice,
} from "@/features/farmerDashboard/types";
import {
  formatRupees,
} from "@/features/farmerDashboard/hooks/utils";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import {
  LowReliabilityBanner,
  ReliabilityFooter,
} from "./MarketReliabilityChip";
import { cn } from "@/lib/utils";

const EMPTY_PRICE: MarketPrice[] = [];

const STALE_HOURS = 6;

const sourceBadgeClass = (source?: string): string =>
  source === "agmarknet"
    ? "bg-emerald-100 text-emerald-800"
    : source === "enam"
      ? "bg-sky-100 text-sky-800"
      : source === "demo"
        ? "bg-stone-200 text-stone-800"
        : "bg-amber-100 text-amber-800";

const sourceLabel = (
  source: string | undefined,
  isDemo: boolean,
  t: (key: string, fallback: string) => string,
): string => {
  if (isDemo) return t("farmer.prices.sourceDemo", "DEMO");
  if (source === "agmarknet") return t("farmer.prices.sourceAgmarknet", "AGMARKNET");
  if (source === "enam") return t("farmer.prices.sourceEnam", "eNAM");
  return t("farmer.prices.sourceLive", "LIVE");
};

const hoursAgo = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
};

export function MarketPricesPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<MarketPriceQuery>({
    commodity: "Tomato",
  });
  const { data: prices, isLoading } = useMarketPrices(filters);
  const refresh = useRefreshMarketPrices();

  // `useMarketPrices` returns a structured `MarketPriceResponse` with a
  // bestMatch + alternatives list. Flatten for the grid view; the
  // bestMatch badge is rendered separately if needed.
  const filtered = useMemo<MarketPrice[]>(() => {
    if (!prices) return EMPTY_PRICE;
    return prices.bestMatch
      ? [prices.bestMatch, ...prices.alternatives]
      : prices.alternatives;
  }, [prices]);

  const trendStats = useMemo(() => {
    const up = filtered.filter((p) => p.changePct > 0).length;
    const down = filtered.filter((p) => p.changePct < 0).length;
    return { up, down, neutral: filtered.length - up - down };
  }, [filtered]);

  // Hard failure: backend call errored and we did NOT silently fall back
  // to demo data. Render an explicit error/no-data state.
  const isErrorState =
    !isLoading &&
    Boolean(prices) &&
    prices?.success === false &&
    prices?.isDemo === false;

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.prices.hint",
          "Live prices from government & private mandis across India. Demo dataset."
        )}
        action={
          <div className="flex items-center gap-2">
            <span
              data-testid="market-source-badge"
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                sourceBadgeClass(prices?.isDemo ? "demo" : "agmarknet"),
              )}
            >
              {sourceLabel(
                prices?.isDemo ? "demo" : "agmarknet",
                Boolean(prices?.isDemo),
                t,
              )}
            </span>
            <button
              type="button"
              onClick={() =>
                refresh.mutate({
                  state: filters.state,
                  market: filters.market,
                  commodity: filters.commodity,
                })
              }
              disabled={refresh.isPending}
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full disabled:opacity-60"
              title={t(
                "farmer.prices.refreshTitle",
                "Re-fetch latest from upstream MCPs",
              )}
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  refresh.isPending && "animate-spin",
                )}
              />
              {t("farmer.prices.refresh", "Refresh")}
            </button>
          </div>
        }
      >
        {t("farmer.prices.title", "Market Prices")}
      </FarmerSectionTitle>

      {/* PHASE 1 §P3.9 — soft warning when live sources are degraded */}
      <LowReliabilityBanner />

      <FarmerCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-emerald-900 font-semibold text-sm">
          <Filter className="h-4 w-4" />
          {t("farmer.prices.filters", "Filters")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-emerald-900/70 mb-1">
              {t("farmer.prices.crop", "Crop")}
            </span>
            <select
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filters.commodity ?? "Tomato"}
              onChange={(e) =>
                setFilters(
                  (f: MarketPriceQuery): MarketPriceQuery => ({
                    ...f,
                    commodity: e.target.value,
                  })
                )
              }
            >
              {COMMODITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-emerald-900/70 mb-1">
              {t("farmer.prices.state", "State")}
            </span>
            <select
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filters.state ?? ""}
              onChange={(e) =>
                setFilters(
                  (f: MarketPriceQuery): MarketPriceQuery => ({
                    ...f,
                    state: e.target.value,
                  })
                )
              }
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-emerald-900/70 mb-1">
              {t("farmer.prices.district", "District")}
            </span>
            <input
              type="text"
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filters.district ?? ""}
              onChange={(e) =>
                setFilters(
                  (f: MarketPriceQuery): MarketPriceQuery => ({
                    ...f,
                    district: e.target.value || undefined,
                  }),
                )
              }
              placeholder={t("farmer.prices.districtPlaceholder", "Optional")}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full">
            <ArrowUpRight className="h-3 w-3" />
            {trendStats.up} {t("farmer.prices.rising", "rising")}
          </span>
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 px-2 py-1 rounded-full">
            <ArrowDownRight className="h-3 w-3" />
            {trendStats.down} {t("farmer.prices.falling", "falling")}
          </span>
          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-1 rounded-full">
            {trendStats.neutral} {t("farmer.prices.flat", "flat")}
          </span>
        </div>
      </FarmerCard>

      {isLoading ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.prices.loading", "Loading latest prices…")}
        </FarmerCard>
      ) : isErrorState ? (
        <FarmerCard
          data-testid="market-error-state"
          className="p-5 border border-rose-200 bg-rose-50/60"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-900">
                {t(
                  "farmer.prices.errorTitle",
                  "Unable to load market prices",
                )}
              </p>
              <p className="text-xs text-rose-800/80 mt-1 break-words">
                {prices?.errorMessage ||
                  t(
                    "farmer.prices.errorFallback",
                    "The market data service is unreachable. Please retry in a moment.",
                  )}
              </p>
              <p className="text-[10px] text-rose-900/60 mt-2">
                {t(
                  "farmer.prices.errorNoDemo",
                  "Demo data is suppressed while the service is down, so you never see synthetic prices labelled as live.",
                )}
              </p>
            </div>
          </div>
        </FarmerCard>
      ) : filtered.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.prices.empty", "No prices match these filters yet.")}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((p) => (
            <FarmerCard key={p.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-emerald-900 truncate">
                    {p.crop}
                  </p>
                  <p className="text-xs text-emerald-900/60 truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {p.market}, {p.state}
                    {/* PHASE 1 §P1.2 — surface state-aggregate provenance */}
                    {p.isAggregate ? (
                      <span
                        data-testid="aggregate-badge"
                        className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        title={t(
                          "farmer.prices.aggregateHint",
                          "State-level roll-up, not a specific mandi",
                        )}
                      >
                        {t("farmer.prices.aggregate", "state avg")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0",
                    p.changePct > 0 && "bg-emerald-50 text-emerald-700",
                    p.changePct < 0 && "bg-rose-50 text-rose-700",
                    p.changePct === 0 && "bg-stone-100 text-stone-700"
                  )}
                >
                  {p.changePct > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : p.changePct < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {p.changePct >= 0 ? "+" : ""}
                  {p.changePct.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Stat
                  label={t("farmer.prices.min", "Min")}
                  value={formatRupees(p.minPrice)}
                />
                <Stat
                  label={t("farmer.prices.modal", "Modal")}
                  value={formatRupees(p.modalPrice)}
                  accent
                />
                <Stat
                  label={t("farmer.prices.max", "Max")}
                  value={formatRupees(p.maxPrice)}
                />
              </div>
              <p className="text-[10px] text-emerald-900/50 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{t("farmer.prices.perQuintal", "per quintal")}</span>
                <span aria-hidden>•</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide",
                    sourceBadgeClass(
                      prices?.isDemo ? "demo" : p.source,
                    ),
                  )}
                >
                  {sourceLabel(
                    prices?.isDemo ? "demo" : p.source,
                    Boolean(prices?.isDemo),
                    t,
                  )}
                </span>
                {(() => {
                  const h = hoursAgo(p.reportedAt);
                  const isStale = h !== null && h > STALE_HOURS;
                  return (
                    <>
                      <span aria-hidden>•</span>
                      <span
                        className={cn(
                          "font-semibold",
                          isStale ? "text-rose-700" : "text-emerald-900/60",
                        )}
                      >
                        {isStale
                          ? t("farmer.prices.stale", "Stale")
                          : t("farmer.prices.fresh", "Fresh")}
                      </span>
                    </>
                  );
                })()}
                <span aria-hidden>•</span>
                <span>{p.reportedAt}</span>
              </p>
            </FarmerCard>
          ))}
        </div>
      )}

      {/* PHASE 1 §P3.9 — per-source reliability strip */}
      <ReliabilityFooter className="pt-3" />
    </FarmerPageContainer>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 min-w-0",
        accent ? "bg-emerald-50" : "bg-stone-50"
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-emerald-900/60 font-semibold truncate">
        {label}
      </p>
      <p
        className={cn(
          "text-xs sm:text-sm font-bold truncate",
          accent ? "text-emerald-900" : "text-emerald-900/80"
        )}
      >
        {value}
      </p>
    </div>
  );
}
