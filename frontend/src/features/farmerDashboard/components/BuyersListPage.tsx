import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Star,
  ShieldCheck,
  Factory,
  MapPin,
  Phone,
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
import { cn } from "@/lib/utils";

export function BuyersListPage() {
  const { t } = useTranslation();
  const { data: buyers } = useBuyers();
  const { data: profile } = useFarmerProfile();
  const { data: lots } = useMyLots();
  const [query, setQuery] = useState("");

  const ranked = useMemo(() => {
    const primaryLot =
      lots?.find((l) => l.status === "active") ?? lots?.[0] ?? null;
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
  }, [buyers, lots, profile, query]);

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.buyers.hint",
          "Verified buyers ranked by how well they match your crop, quantity, quality and distance."
        )}
        action={<DataStateBadge items={buyers} />}
      >
        {t("farmer.buyers.title", "Find Buyers")}
      </FarmerSectionTitle>

      <FarmerCard className="p-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-xl">
          <Search className="h-4 w-4 text-emerald-900/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "farmer.buyers.searchPlaceholder",
              "Search by name, crop, location…"
            )}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-emerald-900/40"
          />
        </div>
      </FarmerCard>

      {ranked.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.buyers.empty", "No buyers match your search yet.")}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {ranked.map(({ buyer, score }) => (
            <Link
              key={buyer.id}
              to="/farmer/buyers/$buyerId"
              params={{ buyerId: buyer.id }}
              className="active:scale-[0.98]"
            >
              <FarmerCard className="p-4 hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Factory className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900 truncate">
                        {buyer.name}
                      </p>
                      <p className="text-xs text-emerald-900/60 truncate">
                        {buyer.type}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-bold px-2 py-1 rounded-full",
                      score >= 75
                        ? "bg-emerald-600 text-white"
                        : score >= 50
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-100 text-stone-700"
                    )}
                  >
                    {score}%
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <p className="text-emerald-900/70 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {buyer.location}
                  </p>
                  <p className="text-emerald-900/70 flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500" />
                    {buyer.rating.toFixed(1)} • {buyer.completedDeals}{" "}
                    {t("farmer.buyers.deals", "deals")}
                  </p>
                  {buyer.verified && (
                    <p className="text-emerald-700 flex items-center gap-1 font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      {t("farmer.buyers.verified", "Verified buyer")}
                    </p>
                  )}
                  {buyer.phone && (
                    <p className="text-emerald-900/60 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {buyer.phone}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {buyer.cropsInterested.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </FarmerCard>
            </Link>
          ))}
        </div>
      )}
    </FarmerPageContainer>
  );
}
