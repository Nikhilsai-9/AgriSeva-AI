import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { HandCoins, Calendar, Sprout } from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useAllMyOffers,
  useUpdateOfferStatus,
} from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate, formatKg, formatRupees } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "pending", "accepted", "rejected", "countered"] as const;
type Filter = (typeof FILTERS)[number];

export function OffersPage() {
  const { t } = useTranslation();
  const { data: offers } = useAllMyOffers();
  const updateOffer = useUpdateOfferStatus();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = (offers ?? []).filter((o) =>
    filter === "all" ? true : o.status === filter
  );

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.offers.hint", "Every offer across all your lots.")}
        action={
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            Demo
          </span>
        }
      >
        {t("farmer.offers.title", "My Offers")}
      </FarmerSectionTitle>

      <FarmerCard className="p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
                filter === f
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              )}
            >
              {t(`farmer.offers.filter.${f}`, f)}
            </button>
          ))}
        </div>
      </FarmerCard>

      {visible.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.offers.empty", "No offers in this view yet.")}
        </FarmerCard>
      ) : (
        <div className="space-y-3">
          {visible.map((offer) => (
            <FarmerCard key={offer.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-900 truncate">
                    {offer.buyerName}
                  </p>
                  <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                    <Sprout className="h-3 w-3" />
                    {offer.crop} • {formatKg(offer.quantityKg)}
                  </p>
                  <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                    <HandCoins className="h-3 w-3" />
                    {formatRupees(offer.pricePerKg)}/kg
                  </p>
                  <p className="text-[10px] text-emerald-900/50 flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {formatDate(offer.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full",
                      offer.status === "pending" && "bg-amber-100 text-amber-800",
                      offer.status === "accepted" && "bg-emerald-100 text-emerald-800",
                      offer.status === "rejected" && "bg-rose-100 text-rose-800",
                      offer.status === "countered" && "bg-sky-100 text-sky-800"
                    )}
                  >
                    {offer.status}
                  </span>
                  <Link
                    to="/farmer/lots/$lotId"
                    params={{ lotId: offer.lotId }}
                    className="text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 px-3 py-1.5 hover:bg-emerald-100"
                  >
                    {t("farmer.offers.viewLot", "View lot")}
                  </Link>
                  {offer.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          updateOffer.mutate({
                            offerId: offer.id,
                            status: "accepted",
                          })
                        }
                        className="text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
                      >
                        {t("farmer.lotDetail.accept", "Accept")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateOffer.mutate({
                            offerId: offer.id,
                            status: "rejected",
                          })
                        }
                        className="text-xs font-semibold rounded-lg bg-rose-100 text-rose-800 px-3 py-1.5 hover:bg-rose-200"
                      >
                        {t("farmer.lotDetail.reject", "Reject")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </FarmerCard>
          ))}
        </div>
      )}
    </FarmerPageContainer>
  );
}
