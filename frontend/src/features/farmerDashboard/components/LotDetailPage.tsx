import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sprout,
  MapPin,
  Calendar,
  HandCoins,
  Package,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useLot,
  useOffersForLot,
  useBuyers,
  useFarmerProfile,
  useUpdateOfferStatus,
} from "@/features/farmerDashboard/hooks/data";
import { computeBuyerMatch } from "@/features/farmerDashboard/hooks/use-market-match";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import {
  formatDate,
  formatKg,
  formatRupees,
} from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

export function LotDetailPage({ lotId }: { lotId: string }) {
  const { t } = useTranslation();
  const { data: lot } = useLot(lotId);
  const { data: offers } = useOffersForLot(lotId);
  const { data: buyers } = useBuyers();
  const { data: profile } = useFarmerProfile();
  const updateOffer = useUpdateOfferStatus();

  if (!lot) {
    return (
      <FarmerPageContainer>
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.lotDetail.notFound", "Lot not found.")}
        </FarmerCard>
      </FarmerPageContainer>
    );
  }

  const rankedBuyers = (buyers ?? [])
    .map((b) => ({
      buyer: b,
      score: computeBuyerMatch(b, profile, lot),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <FarmerPageContainer className="space-y-5">
      <Link
        to="/farmer/lots"
        className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("farmer.common.back", "Back")}
      </Link>

      <FarmerCard className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Sprout className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl sm:text-2xl font-bold text-emerald-900 truncate">
              {lot.crop}
            </p>
            <p className="text-sm text-emerald-900/70">
              Grade {lot.qualityGrade} • {formatKg(lot.quantityKg)}
            </p>
            <p
              className={cn(
                "mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full",
                lot.status === "active" && "bg-emerald-100 text-emerald-800",
                lot.status === "sold" && "bg-sky-100 text-sky-800",
                lot.status === "expired" && "bg-stone-100 text-stone-700",
                lot.status === "draft" && "bg-amber-100 text-amber-800"
              )}
            >
              {lot.status}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Detail icon={<MapPin className="h-4 w-4" />} label={t("farmer.lotDetail.location", "Location")}>
            {lot.district}, {lot.state}
          </Detail>
          <Detail icon={<Calendar className="h-4 w-4" />} label={t("farmer.lotDetail.harvestDate", "Harvest date")}>
            {formatDate(lot.harvestDate)}
          </Detail>
          <Detail icon={<HandCoins className="h-4 w-4" />} label={t("farmer.lotDetail.expectedPrice", "Expected price")}>
            {formatRupees(lot.expectedPricePerKg)}/kg
          </Detail>
          <Detail icon={<Package className="h-4 w-4" />} label={t("farmer.lotDetail.quantity", "Quantity")}>
            {formatKg(lot.quantityKg)}
          </Detail>
        </div>
        {lot.notes && (
          <p className="mt-4 text-sm bg-emerald-50 text-emerald-900 rounded-xl p-3">
            {lot.notes}
          </p>
        )}
      </FarmerCard>

      <FarmerCard className="p-5">
        <FarmerSectionTitle
          hint={t(
            "farmer.lotDetail.offersHint",
            "Buyers who have responded to this lot."
          )}
        >
          {t("farmer.lotDetail.offers", "Offers")} ({offers?.length ?? 0})
        </FarmerSectionTitle>
        {(offers ?? []).length === 0 ? (
          <p className="text-sm text-emerald-900/70">
            {t(
              "farmer.lotDetail.noOffers",
              "No offers yet. Recommended buyers are listed below."
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {(offers ?? []).map((offer) => (
              <div
                key={offer.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-emerald-100 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-900 truncate">
                    {offer.buyerName}
                  </p>
                  <p className="text-xs text-emerald-900/70">
                    {formatRupees(offer.pricePerKg)}/kg • {formatKg(offer.quantityKg)}
                  </p>
                  <p className="text-[10px] text-emerald-900/50 mt-0.5">
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
            ))}
          </div>
        )}
      </FarmerCard>

      <FarmerCard className="p-5">
        <FarmerSectionTitle
          hint={t(
            "farmer.lotDetail.recommendedHint",
            "Best fits based on your crop, quantity and grade."
          )}
          action={<TrendingUp className="h-4 w-4 text-emerald-700" />}
        >
          {t("farmer.lotDetail.recommended", "Recommended Buyers")}
        </FarmerSectionTitle>
        <div className="space-y-2">
          {rankedBuyers.map(({ buyer, score }) => (
            <Link
              key={buyer.id}
              to="/farmer/buyers/$buyerId"
              params={{ buyerId: buyer.id }}
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 p-3 hover:bg-emerald-50/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-900 truncate">
                  {buyer.name}
                </p>
                <p className="text-xs text-emerald-900/60 truncate">
                  {buyer.location}
                </p>
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
            </Link>
          ))}
        </div>
      </FarmerCard>
    </FarmerPageContainer>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
          {label}
        </p>
        <p className="text-sm text-emerald-900 break-words">{children}</p>
      </div>
    </div>
  );
}

