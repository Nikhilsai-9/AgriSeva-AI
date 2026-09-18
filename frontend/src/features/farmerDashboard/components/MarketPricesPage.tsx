import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MapPin,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useMarketPrices,
} from "@/features/farmerDashboard/hooks/data";
import {
  COMMODITIES,
  INDIAN_STATES,
  type MarketPriceFilters,
} from "@/features/farmerDashboard/types";
import {
  formatRupees,
} from "@/features/farmerDashboard/hooks/utils";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { cn } from "@/lib/utils";

export function MarketPricesPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<MarketPriceFilters>({
    crop: "all",
    state: "all",
  });
  const { data: prices, isLoading } = useMarketPrices(filters);

  const filtered = prices ?? [];
  const trendStats = useMemo(() => {
    const up = filtered.filter((p) => p.changePct > 0).length;
    const down = filtered.filter((p) => p.changePct < 0).length;
    return { up, down, neutral: filtered.length - up - down };
  }, [filtered]);

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.prices.hint",
          "Live prices from government & private mandis across India. Demo dataset."
        )}
        action={
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            Demo
          </span>
        }
      >
        {t("farmer.prices.title", "Market Prices")}
      </FarmerSectionTitle>

      <FarmerCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-emerald-900 font-semibold text-sm">
          <Filter className="h-4 w-4" />
          {t("farmer.prices.filters", "Filters")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-emerald-900/70 mb-1">
              {t("farmer.prices.crop", "Crop")}
            </span>
            <select
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={filters.crop}
              onChange={(e) =>
                setFilters((f) => ({ ...f, crop: e.target.value }))
              }
            >
              <option value="all">{t("farmer.prices.allCrops", "All crops")}</option>
              {COMMODITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
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
              value={filters.state}
              onChange={(e) =>
                setFilters((f) => ({ ...f, state: e.target.value }))
              }
            >
              <option value="all">{t("farmer.prices.allStates", "All states")}</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
              <p className="text-[10px] text-emerald-900/50 mt-1">
                {t("farmer.prices.perQuintal", "per quintal")} •{" "}
                {p.reportedAt}
              </p>
            </FarmerCard>
          ))}
        </div>
      )}
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
        "rounded-lg px-2 py-1.5",
        accent ? "bg-emerald-50" : "bg-stone-50"
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-emerald-900/60 font-semibold">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold",
          accent ? "text-emerald-900" : "text-emerald-900/80"
        )}
      >
        {value}
      </p>
    </div>
  );
}
