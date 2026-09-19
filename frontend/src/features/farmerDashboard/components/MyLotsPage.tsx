import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Sprout, MapPin, Calendar } from "lucide-react";
import { useTranslation } from "@/locales";
import { useMyLots } from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate, formatKg } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: "farmer.lots.statusActive",
  sold: "farmer.lots.statusSold",
  expired: "farmer.lots.statusExpired",
  draft: "farmer.lots.statusDraft",
};

const STATUS_FILTERS = ["all", "active", "sold", "expired", "draft"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function MyLotsPage() {
  const { t } = useTranslation();
  const { data: lots } = useMyLots();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "quantity">("newest");

  const visible = useMemo(() => {
    const all = lots ?? [];
    const filtered = status === "all" ? all : all.filter((l) => l.status === status);
    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    } else {
      sorted.sort((a, b) => b.quantityKg - a.quantityKg);
    }
    return sorted;
  }, [lots, status, sort]);

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.lots.hint", "Manage every crop lot you have posted.")}
        action={
          <Link
            to="/farmer/lots/new"
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-3 py-2 hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("farmer.lots.new", "New Lot")}
          </Link>
        }
      >
        {t("farmer.lots.title", "My Lots")}
      </FarmerSectionTitle>

      {(lots ?? []).length > 0 && (
        <FarmerCard className="p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
                  status === s ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                )}
              >
                {t(`farmer.lots.filter.${s}`, s)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-xs text-emerald-900/70">{t("farmer.lots.sortLabel", "Sort")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="newest">{t("farmer.lots.sortNewest", "Newest first")}</option>
              <option value="oldest">{t("farmer.lots.sortOldest", "Oldest first")}</option>
              <option value="quantity">{t("farmer.lots.sortQty", "Largest quantity")}</option>
            </select>
          </label>
        </FarmerCard>
      )}

      {visible.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.lots.empty", "You haven't created any lots yet.")}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visible.map((lot) => (
            <Link key={lot.id} to="/farmer/lots/$lotId" params={{ lotId: lot.id }} className="active:scale-[0.98]">
              <FarmerCard className="p-4 hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Sprout className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900 truncate">{lot.crop}</p>
                      <p className="text-xs text-emerald-900/60 truncate">{formatKg(lot.quantityKg)} - Grade {lot.qualityGrade}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "shrink-0 text-xs font-semibold px-2 py-1 rounded-full",
                    lot.status === "active" && "bg-emerald-100 text-emerald-800",
                    lot.status === "sold" && "bg-sky-100 text-sky-800",
                    lot.status === "expired" && "bg-stone-100 text-stone-700",
                    lot.status === "draft" && "bg-amber-100 text-amber-800"
                  )}>
                    {t(STATUS_LABEL_KEYS[lot.status] ?? "farmer.lots.statusActive", lot.status)}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-emerald-900/70">
                  <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {lot.district}, {lot.state}</p>
                  <p className="flex items-center gap-1 truncate"><Calendar className="h-3 w-3" /> {formatDate(lot.harvestDate)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                    {t("farmer.lots.expectedPrice", "Expected")} Rs {lot.expectedPricePerKg}/kg
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
