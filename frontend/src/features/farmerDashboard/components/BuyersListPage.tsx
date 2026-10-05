import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Star,
  ShieldCheck,
  Factory,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Filter,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { useBuyers, useFarmerProfile, useMyLots } from "@/features/farmerDashboard/hooks/data";
import { computeBuyerMatch } from "@/features/farmerDashboard/hooks/use-market-match";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { DataStateBadge } from "@/features/farmerDashboard/DataStateBadge";
import { COMMODITIES, INDIAN_STATES } from "@/features/farmerDashboard/types";
import { cn } from "@/lib/utils";

export function BuyersListPage() {
  const { t } = useTranslation();
  const { data: profile } = useFarmerProfile();
  const { data: lots } = useMyLots();

  const primaryLot = lots?.find((l) => l.status === "active") ?? lots?.[0] ?? null;
  const initialCrop = primaryLot?.crop || (profile as any)?.primaryCrop || "all";

  const [selectedCrop, setSelectedCrop] = useState<string>(initialCrop);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filters = useMemo(() => ({
    crop: selectedCrop !== "all" ? selectedCrop : undefined,
    state: selectedState !== "all" ? selectedState : undefined,
  }), [selectedCrop, selectedState]);

  const { data: buyers, isLoading, isError, refetch } = useBuyers(filters);

  const ranked = useMemo(() => {
    return (buyers ?? [])
      .map((b) => ({
        buyer: b,
        score: computeBuyerMatch(b, profile, primaryLot ?? undefined),
      }))
      .filter(({ buyer }) =>
        query
          ? buyer.name.toLowerCase().includes(query.toLowerCase()) ||
            buyer.cropsInterested.some((c) =>
              c.toLowerCase().includes(query.toLowerCase())
            ) ||
            buyer.location.toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => b.score - a.score);
  }, [buyers, primaryLot, profile, query]);

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.buyers.hint",
          "Verified commercial buyers ranked by how well they match your crop, quantity, quality and distance."
        )}
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/farmer/lots/new"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("farmer.home.addLot", "New Lot")}</span>
            </Link>
            <DataStateBadge items={buyers} />
          </div>
        }
      >
        {t("farmer.buyers.title", "Find Commercial Buyers")}
      </FarmerSectionTitle>

      {/* Filter and Search Bar */}
      <FarmerCard className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-xl flex-1 border border-stone-200/60">
            <Search className="h-4 w-4 text-emerald-900/50 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "farmer.buyers.searchPlaceholder",
                "Search by buyer name, crop, city…"
              )}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-emerald-900/40"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Crop Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200/60 text-xs">
              <Filter className="h-3.5 w-3.5 text-emerald-700" />
              <span className="font-semibold text-emerald-900/70">
                {t("farmer.buyers.cropLabel", "Crop:")}
              </span>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="bg-transparent font-bold text-emerald-950 outline-none cursor-pointer"
              >
                <option value="all">{t("farmer.buyers.allCropsOption", "All Crops")}</option>
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* State Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200/60 text-xs">
              <span className="font-semibold text-emerald-900/70">
                {t("farmer.buyers.stateLabel", "State:")}
              </span>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-transparent font-bold text-emerald-950 outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="all">{t("farmer.buyers.allStatesOption", "All States")}</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedCrop !== "all" && (
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-800">
            <span className="font-semibold">
              {t("farmer.buyers.showingProcuring", "Showing verified buyers actively procuring:")}
            </span>
            <span className="font-bold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full">
              {selectedCrop}
            </span>
            <button
              onClick={() => setSelectedCrop("all")}
              className="text-emerald-700 underline text-[11px] hover:text-emerald-900"
            >
              {t("farmer.buyers.clearFilter", "Clear filter")}
            </button>
          </div>
        )}
      </FarmerCard>

      {isLoading ? (
        <FarmerCard className="p-12 text-center text-emerald-900/70 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-medium">{t("farmer.buyers.loading", "Finding verified buyers…")}</p>
        </FarmerCard>
      ) : isError ? (
        <FarmerCard className="p-8 text-center text-rose-700 bg-rose-50/50 border-rose-200 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="h-8 w-8 text-rose-600" />
          <p className="text-sm font-medium">{t("farmer.buyers.error", "Failed to load buyers.")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("farmer.buyers.retry", "Retry")}
          </button>
        </FarmerCard>
      ) : ranked.length === 0 ? (
        <FarmerCard className="p-8 text-center text-emerald-900/70">
          <Factory className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
          <p className="font-semibold text-emerald-900">
            {t("farmer.buyers.empty", "No commercial buyers found matching your criteria.")}
          </p>
          <p className="text-xs text-emerald-900/60 mt-1 max-w-md mx-auto">
            {selectedCrop !== "all"
              ? `No buyers are currently listed with demand for ${selectedCrop}. Try switching to another crop or clearing the filter.`
              : "As licensed traders, institutional buyers, and food processing units register, their verified demand profiles will appear here."}
          </p>
          {selectedCrop !== "all" && (
            <button
              onClick={() => setSelectedCrop("all")}
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              {t("farmer.buyers.showAllBuyers", "Show all buyers")}
            </button>
          )}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {ranked.map(({ buyer, score }) => (
            <Link
              key={buyer.id}
              to="/farmer/buyers/$buyerId"
              params={{ buyerId: buyer.id }}
              className="active:scale-[0.98] group"
            >
              <FarmerCard className="p-4 hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Factory className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-950 truncate group-hover:text-emerald-700 transition-colors">
                          {buyer.name}
                        </p>
                        <p className="text-xs text-emerald-900/60 truncate">
                          {buyer.businessType || buyer.type || t("farmer.home.buyerTypeDefault", "Commercial Buyer")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-bold px-2 py-0.5 rounded-full",
                        score >= 75
                          ? "bg-emerald-600 text-white"
                          : score >= 50
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-stone-100 text-stone-700"
                      )}
                    >
                      {t("farmer.buyers.matchPercent", "{score}% match", {
                        score: String(score),
                      })}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <p className="text-emerald-900/70 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">{buyer.location}</span>
                    </p>
                    <p className="text-emerald-900/70 flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>
                        {buyer.rating.toFixed(1)} •{" "}
                        {t("farmer.buyers.dealsCount", "{count} deals fulfilled", {
                          count: String(buyer.completedDeals),
                        })}
                      </span>
                    </p>
                    {buyer.verified && (
                      <p className="text-emerald-700 flex items-center gap-1 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{t("farmer.buyers.verified", "Verified Buyer")}</span>
                      </p>
                    )}
                    {buyer.phone && (
                      <p className="text-emerald-900/60 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        <span>{buyer.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-emerald-50">
                    <span className="text-[10px] font-semibold text-emerald-900/60 uppercase tracking-wider block mb-1">
                      {t("farmer.buyers.cropsProcured", "Crops Procured:")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {buyer.cropsInterested.map((c) => (
                        <span
                          key={c}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-medium",
                            selectedCrop !== "all" && c.toLowerCase() === selectedCrop.toLowerCase()
                              ? "bg-emerald-200 text-emerald-950 font-bold"
                              : "bg-emerald-50 text-emerald-800"
                          )}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-emerald-100/60 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold group-hover:underline">
                    {t("farmer.buyers.viewProfile", "View Buyer Profile →")}
                  </span>
                  <span className="text-[11px] text-emerald-900/50">
                    ID: {buyer.id}
                  </span>
                </div>
              </FarmerCard>
            </Link>
          ))}
        </div>
      )}
    </FarmerPageContainer>
  );
}
