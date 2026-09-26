import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Sprout,
  MapPin,
  Calendar,
  HandCoins,
  Package,
  TrendingUp,
  Store,
  Award,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useLot,
  useOffersForLot,
  useBuyers,
  useFarmerProfile,
  useUpdateOfferStatus,
  useAllMarketPrices,
  useGrievances,
  useUpdateLot,
  useDeleteLot,
  useMarkLotSold,
} from "@/features/farmerDashboard/hooks/data";
import { computeBuyerMatch } from "@/features/farmerDashboard/hooks/use-market-match";
import { recommendBestMarketForLot } from "@/features/farmerDashboard/market-intelligence";
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
  const navigate = useNavigate();
  const { data: lot } = useLot(lotId);
  const { data: offers } = useOffersForLot(lotId);
  const { data: buyers } = useBuyers();
  const { data: profile } = useFarmerProfile();
  const updateOffer = useUpdateOfferStatus();
  const { data: prices } = useAllMarketPrices();
  const { data: grievances } = useGrievances();
  const updateLot = useUpdateLot();
  const deleteLot = useDeleteLot();
  const markLotSold = useMarkLotSold();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [markSoldOpen, setMarkSoldOpen] = useState(false);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [markPrice, setMarkPrice] = useState("");
  const [markBuyer, setMarkBuyer] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  function openEdit() {
    if (!lot) return;
    setEditQty(String(lot.quantityKg));
    setEditPrice(String(lot.expectedPricePerKg));
    setActionError(null);
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!lot) return;
    const q = Number(editQty);
    const p = Number(editPrice);
    if (!isFinite(q) || q <= 0) {
      setActionError(t("farmer.lotDetail.errQty", "Quantity must be positive."));
      return;
    }
    if (!isFinite(p) || p <= 0) {
      setActionError(t("farmer.lotDetail.errPrice", "Price must be positive."));
      return;
    }
    await updateLot.mutateAsync({
      id: lot.id,
      patch: { quantityKg: q, expectedPricePerKg: p },
    });
    setEditOpen(false);
  }

  async function submitDelete() {
    if (!lot) return;
    await deleteLot.mutateAsync({ id: lot.id });
    navigate({ to: "/farmer/lots" });
  }

  async function submitMarkSold() {
    if (!lot) return;
    const p = Number(markPrice);
    if (!isFinite(p) || p <= 0) {
      setActionError(t("farmer.lotDetail.errPrice", "Price must be positive."));
      return;
    }
    if (!markBuyer.trim()) {
      setActionError(t("farmer.lotDetail.errBuyer", "Enter a buyer name."));
      return;
    }
    await markLotSold.mutateAsync({
      id: lot.id,
      finalPricePerKg: p,
      buyerName: markBuyer.trim(),
    });
    setMarkSoldOpen(false);
    setMarkBuyer("");
    setMarkPrice("");
  }

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

  // Market intelligence — best markets for THIS lot.
  const bestMarkets = recommendBestMarketForLot({
    lot,
    prices: prices ?? [],
    buyers: buyers ?? [],
    grievances: grievances ?? [],
  }).slice(0, 5);

  return (
    <FarmerPageContainer className="space-y-5">
      <Link
        to="/farmer/lots"
        className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("farmer.common.back", "Back")}
      </Link>

      <FarmerCard className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sprout className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg sm:text-2xl font-bold text-emerald-900 truncate">
                {lot.crop}
              </p>
              <p className="text-xs sm:text-sm text-emerald-900/70 truncate">
                Grade {lot.qualityGrade} • {formatKg(lot.quantityKg)}
              </p>
              <p
                className={cn(
                  "mt-1 inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full",
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
          <div className="flex flex-wrap items-center sm:flex-col sm:items-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-100">
            {lot.status === "active" && (
              <button
                type="button"
                onClick={() => setMarkSoldOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1.5 hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("farmer.lotDetail.markSold", "Mark sold")}
              </button>
            )}
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-sky-50 text-sky-800 px-2.5 py-1.5 hover:bg-sky-100"
            >
              <Pencil className="h-3 w-3" />
              {t("farmer.lotDetail.edit", "Edit")}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 px-2.5 py-1.5 hover:bg-rose-100"
            >
              <Trash2 className="h-3 w-3" />
              {t("farmer.lotDetail.delete", "Delete")}
            </button>
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
            "farmer.lotDetail.bestMarketsHint",
            "Sorted by realisable net value after transport & fees"
          )}
          action={<Award className="h-4 w-4 text-emerald-700" />}
        >
          {t("farmer.lotDetail.bestMarkets", "Best markets for this lot")}
        </FarmerSectionTitle>
        {bestMarkets.length === 0 ? (
          <p className="text-sm text-emerald-900/70">
            {t(
              "farmer.lotDetail.bestMarketsEmpty",
              "No matching mandi data yet."
            )}
          </p>
        ) : (
          <div className="space-y-2">
            {bestMarkets.map((c: ReturnType<typeof recommendBestMarketForLot>[number], idx: number) => (
              <div
                key={c.price.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      idx === 0
                        ? "bg-emerald-600 text-white"
                        : "bg-sky-100 text-sky-700",
                    )}
                  >
                    {idx === 0 ? (
                      <Award className="h-4 w-4" />
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate">
                      {c.price.market}
                      {/* PHASE 1 §P1.2 — surface state-aggregate provenance */}
                      {c.price.isAggregate ? (
                        <span
                          data-testid="aggregate-badge-lot-detail"
                          className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider align-middle"
                          title={t(
                            "farmer.lotDetail.aggregateHint",
                            "State-level roll-up, not a specific mandi",
                          )}
                        >
                          {t("farmer.lotDetail.aggregate", "state avg")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-emerald-900/60 truncate">
                      {c.price.distanceKm ?? 0} km • {c.price.source}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-900">
                    {formatRupees(c.realisable.net)}
                  </p>
                  <p className="text-[10px] text-emerald-900/50">
                    {c.score}/100
                  </p>
                </div>
              </div>
            ))}
            <Link
              to="/farmer/recommend"
              className="block text-center text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 hover:bg-emerald-100"
            >
              {t(
                "farmer.lotDetail.bestMarkets",
                "Best markets for this lot"
              )}{" "}
              →
            </Link>
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
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-emerald-900">{t("farmer.lotDetail.editTitle", "Edit lot")}</p>
              <button type="button" onClick={() => setEditOpen(false)} className="text-emerald-900/60 hover:text-emerald-900"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitEdit(); }} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.lotDetail.fieldQty", "Quantity (kg)")}</span>
                <input type="number" min={1} required value={editQty} onChange={(e) => setEditQty(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.lotDetail.fieldPrice", "Expected price (Rs/kg)")}</span>
                <input type="number" min={0.01} step={0.01} required value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              {actionError && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{actionError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200">{t("farmer.common.cancel", "Cancel")}</button>
                <button type="submit" disabled={updateLot.isPending} className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50">
                  {updateLot.isPending ? t("farmer.common.submitting", "Submitting...") : t("farmer.common.save", "Save")}
                </button>
              </div>
            </form>
          </FarmerCard>
        </div>
      )}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-md p-5">
            <p className="text-base font-bold text-emerald-900 mb-2">{t("farmer.lotDetail.deleteTitle", "Delete lot?")}</p>
            <p className="text-sm text-emerald-900/70 mb-4">{t("farmer.lotDetail.deleteHint", "This will also remove all offers on this lot. This cannot be undone.")}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200">{t("farmer.common.cancel", "Cancel")}</button>
              <button type="button" onClick={submitDelete} disabled={deleteLot.isPending} className="rounded-xl bg-rose-600 text-white text-sm font-semibold px-4 py-2 hover:bg-rose-700 disabled:opacity-50">
                {deleteLot.isPending ? t("farmer.common.submitting", "Submitting...") : t("farmer.lotDetail.delete", "Delete")}
              </button>
            </div>
          </FarmerCard>
        </div>
      )}
      {markSoldOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-emerald-900">{t("farmer.lotDetail.markSoldTitle", "Mark lot sold")}</p>
              <button type="button" onClick={() => setMarkSoldOpen(false)} className="text-emerald-900/60 hover:text-emerald-900"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitMarkSold(); }} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.lotDetail.fieldPrice", "Final price (Rs/kg)")}</span>
                <input type="number" min={0.01} step={0.01} required value={markPrice} onChange={(e) => setMarkPrice(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.lotDetail.markSoldBuyer", "Buyer name")}</span>
                <input required value={markBuyer} onChange={(e) => setMarkBuyer(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              {actionError && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{actionError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setMarkSoldOpen(false)} className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200">{t("farmer.common.cancel", "Cancel")}</button>
                <button type="submit" disabled={markLotSold.isPending} className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50">
                  {markLotSold.isPending ? t("farmer.common.submitting", "Submitting...") : t("farmer.lotDetail.confirmSold", "Confirm sale")}
                </button>
              </div>
            </form>
          </FarmerCard>
        </div>
      )}
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

