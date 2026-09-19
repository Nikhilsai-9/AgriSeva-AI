import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Store,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Truck,
  Weight,
  Receipt,
  Award,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/locales";
import {
  useMyLots,
  useAllMarketPrices,
  useBuyers,
  useGrievances,
} from "@/features/farmerDashboard/hooks/data";
import {
  formatKg,
  formatRupees,
} from "@/features/farmerDashboard/hooks/utils";
import {
  recommendBestMarketForLot,
  sourceLabel,
} from "@/features/farmerDashboard/market-intelligence";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { cn } from "@/lib/utils";

export function MarketComparisonPage() {
  const { t } = useTranslation();
  const { data: lots } = useMyLots();
  const { data: prices } = useAllMarketPrices();
  const { data: buyers } = useBuyers();
  const { data: grievances } = useGrievances();

  const activeLot =
    lots?.find((l) => l.status === "active") ?? lots?.[0] ?? null;

  const candidates = activeLot
    ? recommendBestMarketForLot({
        lot: activeLot,
        prices: prices ?? [],
        buyers: buyers ?? [],
        grievances: grievances ?? [],
      })
    : [];

  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  if (!activeLot) {
    return (
      <FarmerPageContainer className="space-y-5">
        <Link
          to="/farmer"
          className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("farmer.common.back", "Back")}
        </Link>
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t(
            "farmer.recommend.empty",
            "Create an active lot to compare markets."
          )}
        </FarmerCard>
      </FarmerPageContainer>
    );
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <Link to="/farmer" className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold">
        <ArrowLeft className="h-4 w-4" />
        {t("farmer.common.back", "Back")}
      </Link>
      <FarmerSectionTitle
        hint={t("farmer.recommend.hint", "Compare all mandis for your active lot side by side.")}
        action={<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">{t("farmer.common.sourceDemo", "Demo")}</span>}
      >
        {t("farmer.recommend.title", "Market comparison")}
      </FarmerSectionTitle>
      <FarmerCard className="p-4 sm:p-5 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Weight className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-900 truncate">{activeLot.crop} - Grade {activeLot.qualityGrade}</p>
          <p className="text-xs text-emerald-900/70 truncate">{formatKg(activeLot.quantityKg)} - {activeLot.district}, {activeLot.state}</p>
        </div>
      </FarmerCard>
      {candidates.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.lotDetail.bestMarketsEmpty", "No matching mandi data yet.")}
        </FarmerCard>
      ) : (
        <div className="space-y-3">
          {candidates.map((c: ReturnType<typeof recommendBestMarketForLot>[number], idx: number) => {
            const expanded = expandedIdx === idx;
            return (
              <FarmerCard key={c.price.id} className={cn("p-4 sm:p-5 transition-shadow", idx === 0 && "ring-2 ring-emerald-300/70")}>
                <button type="button" onClick={() => setExpandedIdx(expanded ? null : idx)} className="w-full text-left" aria-expanded={expanded}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", idx === 0 ? "bg-emerald-600 text-white" : "bg-sky-100 text-sky-700")}>
                      {idx === 0 ? <Award className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-900 truncate">
                        <span className="text-xs text-emerald-900/50 mr-2">{t("farmer.recommend.rankBadge", "#{rank}", { rank: String(idx + 1) })}</span>
                        {c.price.market}
                      </p>
                      <p className="text-xs text-emerald-900/70 truncate">
                        {c.price.district}, {c.price.state} - {c.price.distanceKm ?? 0} km - {sourceLabel(c.price)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-emerald-900">{formatRupees(c.realisable.net)}</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">{t("farmer.recommend.colNet", "Net realisable")}</p>
                    </div>
                    <div className="shrink-0 ml-1">
                      {expanded ? <ChevronUp className="h-4 w-4 text-emerald-900/50" /> : <ChevronDown className="h-4 w-4 text-emerald-900/50" />}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                      <div className={cn("h-full", idx === 0 ? "bg-emerald-600" : "bg-sky-500")} style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-emerald-900">{c.score}/100</span>
                  </div>
                </button>
                {expanded && (
                  <div className="mt-4 space-y-3 border-t border-emerald-100 pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Stat icon={<TrendingUp className="h-4 w-4" />} label={t("farmer.recommend.colPrice", "Price /kg")} value={`₹ ${c.realisable.pricePerKg.toFixed(2)}`} />
                      <Stat icon={<Receipt className="h-4 w-4" />} label={t("farmer.recommend.colGross", "Gross")} value={formatRupees(c.realisable.gross)} />
                      <Stat icon={<Truck className="h-4 w-4" />} label={t("farmer.recommend.colDeductions", "Deductions")} value={formatRupees(c.realisable.breakdown.total)} />
                      <Stat icon={<Store className="h-4 w-4" />} label={t("farmer.recommend.colBuyer", "Top buyer")} value={c.buyer?.name ?? "-"} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-900 mb-1">{t("farmer.recommend.fullBreakdown", "Full breakdown")}</p>
                      <ul className="space-y-1 text-xs text-emerald-900/80">
                        <BreakdownLine label={t("farmer.recommend.transport", "Transport")} value={formatRupees(c.realisable.breakdown.transport)} />
                        <BreakdownLine label={t("farmer.recommend.loading", "Loading")} value={formatRupees(c.realisable.breakdown.loading)} />
                        <BreakdownLine label={t("farmer.recommend.unloading", "Unloading")} value={formatRupees(c.realisable.breakdown.unloading)} />
                        <BreakdownLine label={t("farmer.recommend.marketFee", "Market fee")} value={formatRupees(c.realisable.breakdown.marketFee)} />
                        <BreakdownLine label={t("farmer.recommend.insurance", "Insurance")} value={formatRupees(c.realisable.breakdown.insurance)} />
                        <BreakdownLine label={t("farmer.recommend.other", "Other")} value={formatRupees(c.realisable.breakdown.other)} />
                      </ul>
                    </div>
                    {c.reasons.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-900 mb-1">{t("farmer.recommend.why", "Why we recommend this")}</p>
                        <ul className="space-y-1 text-xs text-emerald-900/80">
                          {c.reasons.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold">v</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </FarmerCard>
            );
          })}
        </div>
      )}
    </FarmerPageContainer>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-emerald-700">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">{label}</span>
      </div>
      <span className="text-sm font-bold text-emerald-900 break-words">{value}</span>
    </div>
  );
}

function BreakdownLine({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-emerald-900/70">{label}</span>
      <span className="font-semibold text-emerald-900">-{value}</span>
    </li>
  );
}
