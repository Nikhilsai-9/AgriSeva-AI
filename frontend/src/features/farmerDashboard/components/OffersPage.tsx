import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  HandCoins,
  Calendar,
  Sprout,
  Scale,
  X,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useAllMyOffers,
  useUpdateOfferStatus,
  useCounterOffer,
} from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate, formatKg, formatRupees } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";
import { DataStateBadge } from "@/features/farmerDashboard/DataStateBadge";

const FILTERS = ["all", "pending", "accepted", "rejected", "countered"] as const;
type Filter = (typeof FILTERS)[number];

export function OffersPage() {
  const { t } = useTranslation();
  const { data: offers } = useAllMyOffers();
  const updateOffer = useUpdateOfferStatus();
  const counter = useCounterOffer();
  const [filter, setFilter] = useState<Filter>("all");
  const [counterOpenId, setCounterOpenId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState<string>("");
  const [counterMessage, setCounterMessage] = useState<string>("");
  const [counterError, setCounterError] = useState<string | null>(null);

  const visible = (offers ?? []).filter((o) =>
    filter === "all" ? true : o.status === filter
  );

  function openCounter(offerId: string, currentPrice: number) {
    setCounterOpenId(offerId);
    setCounterPrice(String(currentPrice));
    setCounterMessage("");
    setCounterError(null);
  }

  async function submitCounter() {
    if (!counterOpenId) return;
    const price = Number(counterPrice);
    if (!isFinite(price) || price <= 0) {
      setCounterError(t("farmer.offers.counterError", "Enter a positive price."));
      return;
    }
    await counter.mutateAsync({
      offerId: counterOpenId,
      pricePerKg: price,
      message: counterMessage.trim() || undefined,
    });
    setCounterOpenId(null);
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
      <FarmerSectionTitle
        hint={t("farmer.offers.hint", "Every offer across all your lots.")}
        action={<DataStateBadge items={offers} />}
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
                  {offer.status === "accepted" ? (
                    <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t(
                        "farmer.offers.expectedBy",
                        "Expected by {date}",
                        {
                          date: formatDate(
                            new Date(
                              Date.now() +
                                3 * 24 * 60 * 60 * 1000,
                            ).toISOString(),
                          ),
                        },
                      )}
                    </p>
                  ) : null}
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
                  <Link
                    to="/farmer/recommend"
                    className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-sky-50 text-sky-800 px-3 py-1.5 hover:bg-sky-100"
                  >
                    <Scale className="h-3 w-3" />
                    {t(
                      "farmer.offers.viewMarketComparison",
                      "Compare markets",
                    )}
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
                        onClick={() => openCounter(offer.id, offer.pricePerKg)}
                        className="text-xs font-semibold rounded-lg bg-sky-100 text-sky-800 px-3 py-1.5 hover:bg-sky-200"
                      >
                        {t("farmer.offers.counter", "Counter")}
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
      {counterOpenId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-emerald-900">
                {t("farmer.offers.counterTitle", "Send counter offer")}
              </p>
              <button
                type="button"
                onClick={() => setCounterOpenId(null)}
                className="text-emerald-900/60 hover:text-emerald-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCounter();
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">
                  {t("farmer.offers.counterPrice", "Your counter price (Rs/kg)")}
                </span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  required
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">
                  {t("farmer.offers.counterNote", "Optional note")}
                </span>
                <textarea
                  rows={3}
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              {counterError && (
                <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                  {counterError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCounterOpenId(null)}
                  className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200"
                >
                  {t("farmer.common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={counter.isPending}
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {counter.isPending
                    ? t("farmer.common.submitting", "Submitting...")
                    : t("farmer.offers.sendCounter", "Send counter")}
                </button>
              </div>
            </form>
          </FarmerCard>
        </div>
      )}
    </FarmerPageContainer>
  );
}
