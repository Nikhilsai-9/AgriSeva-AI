import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sprout,
  TrendingUp,
  Award,
  ShieldCheck,
  MapPin,
  AlertCircle,
  RefreshCw,
  Loader2,
  Store,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useFarmerProfile,
  useCreateLot,
  useAllMarketPrices,
  useBuyers,
  useGrievances,
  useMarketPrices,
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
import { cn } from "@/lib/utils";

export function CreateLotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile, isLoading: isProfileLoading } = useFarmerProfile();
  const createLot = useCreateLot();
  const { data: allPrices } = useAllMarketPrices();
  const { data: buyers } = useBuyers();
  const { data: grievances } = useGrievances();

  const [crop, setCrop] = useState("");
  const [selectedMandi, setSelectedMandi] = useState("");
  const [qualityGrade, setQualityGrade] = useState<QualityGrade>("A");
  const [quantityKg, setQuantityKg] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [expectedPricePerKg, setExpectedPricePerKg] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Farmer's location from their profile (source of truth).
  const farmerState = profile?.state ?? "";
  const farmerDistrict = profile?.district ?? "";

  // Fetch real market prices for the selected crop filtered by farmer's state.
  const cropPricesQuery = useMarketPrices({
    commodity: crop,
    state: farmerState || undefined,
    limit: 30,
  });

  // Derive the list of available mandis for the selected crop.
  const availableMandis = useMemo(() => {
    if (!cropPricesQuery.data?.bestMatch && !cropPricesQuery.data?.alternatives?.length) {
      return [];
    }
    const all = [
      ...(cropPricesQuery.data.bestMatch ? [cropPricesQuery.data.bestMatch] : []),
      ...(cropPricesQuery.data.alternatives ?? []),
    ];
    // Deduplicate by market name.
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.market)) return false;
      seen.add(p.market);
      return true;
    });
  }, [cropPricesQuery.data]);

  // When crop changes, clear the selected mandi.
  useEffect(() => {
    setSelectedMandi("");
  }, [crop]);

  // Selected mandi price details.
  const selectedMandiPrice = useMemo(
    () => availableMandis.find((m) => m.market === selectedMandi) ?? null,
    [availableMandis, selectedMandi],
  );

  // When a mandi is selected, auto-fill expected price from modal price (₹/quintal → ₹/kg).
  useEffect(() => {
    if (selectedMandiPrice && selectedMandiPrice.modalPrice > 0 && !expectedPricePerKg) {
      // Modal price in database is ₹/quintal; convert to ₹/kg.
      const unit = selectedMandiPrice.unit ?? "";
      const isPerQuintal = unit.toLowerCase().includes("quintal") || unit.toLowerCase().includes("qtl");
      const pricePerKg = isPerQuintal
        ? selectedMandiPrice.modalPrice / 100
        : selectedMandiPrice.modalPrice;
      setExpectedPricePerKg(pricePerKg.toFixed(2));
    }
  }, [selectedMandiPrice, expectedPricePerKg]);

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
      (allPrices?.length ?? 0) === 0
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
      state: farmerState || "Karnataka",
      district: farmerDistrict || "Kolar",
      village: profile?.village ?? "",
      harvestDate: new Date().toISOString().slice(0, 10),
      images: [],
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    const candidates = recommendBestMarketForLot({
      lot: draftLot,
      prices: allPrices ?? [],
      buyers: buyers ?? [],
      grievances: grievances ?? [],
    });
    return candidates[0] ?? null;
  }, [
    debounced.crop,
    debounced.quantityKg,
    debounced.qualityGrade,
    debounced.expectedPricePerKg,
    allPrices,
    buyers,
    grievances,
    profile,
    farmerState,
    farmerDistrict,
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
    // state and district MUST come from the authenticated farmer's profile.
    if (!farmerState || !farmerDistrict) {
      setError(
        t(
          "farmer.createLot.errLocation",
          "Your profile is missing State and District. Please update your profile first.",
        ),
      );
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
        state: farmerState,
        district: farmerDistrict,
        village: profile?.village ?? "",
        status: "active",
      } as any);
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
  const isCropPricesLoading = crop !== "" && cropPricesQuery.isLoading;

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
          "Publish your harvest to verified buyers and discover top-paying mandis in real time.",
        )}
      >
        {t("farmer.createLot.title", "Create New Lot")}
      </FarmerSectionTitle>

      {/* Profile location banner */}
      {!isProfileLoading && farmerState && (
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>
            {t("farmer.createLot.locationSource", "Location from your profile")}:{" "}
            <strong>{farmerDistrict}, {farmerState}</strong>
          </span>
        </div>
      )}
      {!isProfileLoading && !farmerState && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {t(
              "farmer.createLot.locationMissing",
              "Your profile is missing State and District. Please update your profile so lot creation can work correctly.",
            )}
          </span>
        </div>
      )}

      <FarmerCard className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Sprout className="h-5 w-5" />
            <p className="font-semibold">
              {t("farmer.createLot.section", "Lot details")}
            </p>
          </div>

          {/* Crop selection */}
          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.createLot.crop", "Crop")} *
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

          {/* Mandi selection — populated from real market data for the selected crop */}
          {crop && (
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.mandi", "Market / Mandi")}
                {" "}
                <span className="text-[10px] font-normal text-emerald-700 uppercase tracking-wider">
                  {farmerState ? `(${farmerState})` : ""}
                </span>
              </span>
              {isCropPricesLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("farmer.createLot.loadingMandis", "Loading available markets…")}
                </div>
              ) : availableMandis.length > 0 ? (
                <select
                  value={selectedMandi}
                  onChange={(e) => setSelectedMandi(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{t("farmer.createLot.selectMandi", "Select a market…")}</option>
                  {availableMandis.map((m) => (
                    <option key={m.id} value={m.market}>
                      {m.market} — {m.district}, {m.state}
                      {m.modalPrice > 0 ? ` — ₹${m.modalPrice.toLocaleString("en-IN")}/${m.unit}` : ""}
                    </option>
                  ))}
                </select>
              ) : cropPricesQuery.isError ? (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t("farmer.createLot.mandiError", "Could not load market data. You can still submit without selecting a mandi.")}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-900/60 bg-stone-50 rounded-xl px-3 py-2">
                  <Store className="h-4 w-4 shrink-0" />
                  {t("farmer.createLot.mandiNone", "No current market data available for this crop. You can still submit without selecting a mandi.")}
                </div>
              )}
            </label>
          )}

          {/* Live mandi price preview when a mandi is selected */}
          {selectedMandiPrice && (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-700" />
                <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                  {t("farmer.createLot.mandiLivePrices", "Live Market Data")}
                </p>
                <span className="ml-auto text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedMandiPrice.source?.toUpperCase() ?? "LIVE"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-900/60 font-semibold">Min</p>
                  <p className="font-bold text-emerald-900">
                    {selectedMandiPrice.minPrice > 0
                      ? `₹${selectedMandiPrice.minPrice.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-emerald-900/50">{selectedMandiPrice.unit}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-900/60 font-semibold">Modal</p>
                  <p className="font-bold text-emerald-900 text-base">
                    {selectedMandiPrice.modalPrice > 0
                      ? `₹${selectedMandiPrice.modalPrice.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-emerald-900/50">{selectedMandiPrice.unit}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-900/60 font-semibold">Max</p>
                  <p className="font-bold text-emerald-900">
                    {selectedMandiPrice.maxPrice > 0
                      ? `₹${selectedMandiPrice.maxPrice.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-emerald-900/50">{selectedMandiPrice.unit}</p>
                </div>
              </div>
              {selectedMandiPrice.arrivalDate && (
                <p className="text-[10px] text-emerald-900/50 mt-2">
                  {t("farmer.createLot.mandiUpdated", "Arrival date")}: {selectedMandiPrice.arrivalDate}
                </p>
              )}
              {selectedMandiPrice.isAggregate && (
                <p className="text-[10px] text-amber-700 mt-1">
                  ⚠ {t("farmer.createLot.aggregate", "State-level aggregate — no per-mandi price available")}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.quantity", "Quantity (kg)")} *
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
                <option value="A">A — Premium</option>
                <option value="B">B — Standard</option>
                <option value="C">C — Economy</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-900 mb-1">
                {t("farmer.createLot.harvestDate", "Harvest date")} *
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
                {t("farmer.createLot.expectedPrice", "Expected price (₹/kg)")} *
                {selectedMandiPrice?.modalPrice > 0 && (
                  <span className="text-[10px] font-normal text-emerald-700 ml-1">
                    (auto-filled from modal)
                  </span>
                )}
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
                "Storage conditions, certifications, variety…",
              )}
            />
          </label>

          <button
            type="submit"
            disabled={isBusy || isProfileLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBusy
              ? t("farmer.createLot.submitting", "Publishing…")
              : t("farmer.createLot.submit", "Publish Lot")}
          </button>
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
            preview?.price?.source ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                {preview.price.source.toUpperCase()}
              </span>
            ) : null
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
