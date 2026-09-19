import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sprout,
  TrendingUp,
  Award,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useFarmerProfile,
  useCreateLot,
  useAllMarketPrices,
  useBuyers,
  useGrievances,
} from "@/features/farmerDashboard/hooks/data";
import {
  recommendBestMarketForLot,
  reliabilityEvidence,
} from "@/features/farmerDashboard/market-intelligence";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import {
  formatRupees,
} from "@/features/farmerDashboard/hooks/utils";
import { COMMODITIES, type FarmerLot, type QualityGrade } from "@/features/farmerDashboard/types";

export function CreateLotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile } = useFarmerProfile();
  const createLot = useCreateLot();
  const { data: prices } = useAllMarketPrices();
  const { data: buyers } = useBuyers();
  const { data: grievances } = useGrievances();

  const [crop, setCrop] = useState("");
  const [qualityGrade, setQualityGrade] = useState<QualityGrade>("A");
  const [quantityKg, setQuantityKg] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [expectedPricePerKg, setExpectedPricePerKg] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Debounced (200ms) snapshot of the form used by the live-preview panel.
  const [debounced, setDebounced] = useState({
    crop,
    quantityKg,
    qualityGrade,
    expectedPricePerKg,
  });

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced({
        crop,
        quantityKg,
        qualityGrade,
        expectedPricePerKg,
      });
    }, 200);
    return () => clearTimeout(id);
  }, [crop, quantityKg, qualityGrade, expectedPricePerKg]);

  const preview = useMemo(() => {
    const qty = Number(debounced.quantityKg);
    if (
      !debounced.crop ||
      !isFinite(qty) ||
      qty <= 0 ||
      (prices?.length ?? 0) === 0
    ) {
      return null;
    }
    const draftLot: FarmerLot = {
      id: "draft",
      farmerId: profile?.uid ?? "draft",
      crop: debounced.crop,
      variety: "",
      quantityKg: qty,
      qualityGrade: debounced.qualityGrade,
      qualityNotes: "",
      expectedPricePerKg: Number(debounced.expectedPricePerKg) || 0,
      state: profile?.state ?? "Karnataka",
      district: profile?.district ?? "Kolar",
      village: profile?.village ?? "",
      harvestDate: new Date().toISOString().slice(0, 10),
      images: [],
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true,
    };
    const candidates = recommendBestMarketForLot({
      lot: draftLot,
      prices: prices ?? [],
      buyers: buyers ?? [],
      grievances: grievances ?? [],
    });
    return candidates[0] ?? null;
  }, [
    debounced.crop,
    debounced.quantityKg,
    debounced.qualityGrade,
    debounced.expectedPricePerKg,
    prices,
    buyers,
    grievances,
    profile,
  ]);

  const previewBuyerReliability = preview?.buyer
    ? reliabilityEvidence(preview.buyer, grievances ?? [])
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!crop) {
      setError(t("farmer.createLot.errCrop", "Select a crop."));
      return;
    }
    const q = Number(quantityKg);
    if (!isFinite(q) || q <= 0) {
      setError(t("farmer.createLot.errQty", "Quantity must be a positive number."));
      return;
    }
    if (!harvestDate) {
      setError(t("farmer.createLot.errDate", "Harvest date is required."));
      return;
    }
    const p = Number(expectedPricePerKg);
    if (!isFinite(p) || p <= 0) {
      setError(t("farmer.createLot.errPrice", "Expected price must be a positive number."));
      return;
    }
    try {
      const lot = await createLot.mutateAsync({
        crop,
        qualityGrade,
        quantityKg: q,
        harvestDate,
        expectedPricePerKg: p,
        notes: notes.trim(),
        state: profile?.state ?? "Maharashtra",
        district: profile?.district ?? "Pune",
      });
      navigate({ to: "/farmer/lots/$lotId", params: { lotId: lot.id } });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("farmer.createLot.errGeneric", "Could not publish lot. Try again."),
      );
    }
  }

  const isBusy = createLot.isPending;

  return (
    <FarmerPageContainer className="space-y-5">
      <Link
        to="/farmer/lots"
        className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("farmer.common.back", "Back")}
      </Link>
      <FarmerSectionTitle
        hint={t(
          "farmer.createLot.hint",
          "Create a lot to publish your crop to buyers. Demo only — no real buyers will see it."
        )}
      >
        {t("farmer.createLot.title", "Create New Lot")}
      </FarmerSectionTitle>

      <FarmerCard className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Sprout className="h-5 w-5" />
            <p className="font-semibold">
              {t("farmer.createLot.section", "Lot details")}
            </p>
          </div>

          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.createLot.crop", "Crop")}
            </span>
            <select
              required
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">
                {t("farmer.createLot.selectCrop", "Select crop…")}
              </option>
              {COMMODITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.quantity", "Quantity (kg)")}
              </span>
              <input
                type="number"
                required
                min={1}
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.grade", "Grade")}
              </span>
              <select
                value={qualityGrade}
                onChange={(e) =>
                  setQualityGrade(e.target.value as QualityGrade)
                }
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.harvestDate", "Harvest date")}
              </span>
              <input
                type="date"
                required
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.expectedPrice", "Expected price (₹/kg)")}
              </span>
              <input
                type="number"
                required
                min={1}
                step="0.5"
                value={expectedPricePerKg}
                onChange={(e) => setExpectedPricePerKg(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.createLot.notes", "Notes (optional)")}
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={t(
                "farmer.createLot.notesPlaceholder",
                "Storage conditions, certifications, variety…"
              )}
            />
          </label>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isBusy
              ? t("farmer.createLot.submitting", "Publishing…")
              : t("farmer.createLot.submit", "Publish Lot")}
          </button>
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>
      </FarmerCard>

      {/* Live preview — market intelligence (debounced 200ms) */}
      <FarmerCard className="p-5 bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <FarmerSectionTitle
          hint={t(
            "farmer.createLot.previewHint",
            "Updates as you fill the form (debounced).",
          )}
          action={
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              {t("farmer.common.sourceDemo", "Demo")}
            </span>
          }
        >
          {t("farmer.createLot.previewTitle", "Live preview")}
        </FarmerSectionTitle>
        {!preview ? (
          <p className="text-sm text-emerald-900/70">
            {t(
              "farmer.createLot.previewEmpty",
              "Fill the form to see a live estimate.",
            )}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <PreviewStat
                icon={<TrendingUp className="h-4 w-4" />}
                label={t("farmer.createLot.previewNet", "Estimated net realisable")}
                value={formatRupees(preview.realisable.net)}
              />
              <PreviewStat
                icon={<Award className="h-4 w-4" />}
                label={t("farmer.createLot.previewBestMarket", "Best market right now")}
                value={preview.price.market}
              />
              <PreviewStat
                icon={<Award className="h-4 w-4" />}
                label={t("farmer.createLot.previewScore", "Match score")}
                value={`${preview.score}/100`}
              />
              <PreviewStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t("farmer.createLot.previewReliability", "Reliability")}
                value={
                  previewBuyerReliability?.suppressed
                    ? "—"
                    : previewBuyerReliability?.score != null
                      ? `${previewBuyerReliability.score}/100`
                      : "—"
                }
              />
            </div>
            <div className="text-xs text-emerald-900/70">
              <span className="font-semibold text-emerald-900">
                {t("farmer.createLot.previewBuyer", "Top matched buyer")}:
              </span>{" "}
              {preview.buyer ? preview.buyer.name : t("farmer.lotDetail.bestMarketsEmpty", "No matching mandi data yet.")}
            </div>
          </div>
        )}
      </FarmerCard>
    </FarmerPageContainer>
  );
}

function PreviewStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-emerald-700">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
          {label}
        </span>
      </div>
      <span className="text-sm font-bold text-emerald-900 break-words">
        {value}
      </span>
    </div>
  );
}
