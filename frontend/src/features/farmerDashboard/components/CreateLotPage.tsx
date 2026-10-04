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
  Loader2,
  Store,
  CheckCircle2,
  Calendar,
  Layers,
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
import {
  COMMODITIES,
  INDIAN_STATES,
  type FarmerLot,
  type QualityGrade,
} from "@/features/farmerDashboard/types";
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
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [village, setVillage] = useState("");
  const [selectedMandi, setSelectedMandi] = useState("");
  const [customMandi, setCustomMandi] = useState("");
  const [qualityGrade, setQualityGrade] = useState<QualityGrade>("A");
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<"quintal" | "kg">("quintal");
  const [harvestDate, setHarvestDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [expectedPricePerKg, setExpectedPricePerKg] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync state & district from profile once loaded if not already edited
  useEffect(() => {
    if (profile?.state && !state) {
      setState(profile.state);
    } else if (!state) {
      setState("Maharashtra");
    }
    if (profile?.district && !district) {
      setDistrict(profile.district);
    }
    if (profile?.village && !village) {
      setVillage(profile.village);
    }
  }, [profile]);

  // Fetch real market prices for the selected crop and state
  const cropPricesQuery = useMarketPrices({
    commodity: crop,
    state: state || undefined,
    limit: 50,
  });

  // Derive the list of available mandis for the selected crop
  const availableMandis = useMemo(() => {
    const stateRows = [
      ...(cropPricesQuery.data?.bestMatch ? [cropPricesQuery.data.bestMatch] : []),
      ...(cropPricesQuery.data?.alternatives ?? []),
    ];

    const sourceRows =
      stateRows.length > 0
        ? stateRows
        : (allPrices ?? []).filter(
            (p) =>
              !crop ||
              p.crop?.toLowerCase().includes(crop.toLowerCase()) ||
              p.commodity?.toLowerCase().includes(crop.toLowerCase())
          );

    // Deduplicate by market name
    const seen = new Set<string>();
    return sourceRows.filter((p) => {
      if (!p.market || seen.has(p.market)) return false;
      seen.add(p.market);
      return true;
    });
  }, [cropPricesQuery.data, allPrices, crop]);

  // Reset mandi when crop or state changes
  useEffect(() => {
    setSelectedMandi("");
    setCustomMandi("");
  }, [crop, state]);

  // Selected mandi price details
  const selectedMandiPrice = useMemo(
    () => availableMandis.find((m) => m.market === selectedMandi) ?? null,
    [availableMandis, selectedMandi]
  );

  // When a mandi is selected, auto-fill district and auto-calculate expected price (₹/quintal → ₹/kg)
  useEffect(() => {
    if (selectedMandiPrice) {
      if (selectedMandiPrice.district && !district) {
        setDistrict(selectedMandiPrice.district);
      }
      if (selectedMandiPrice.modalPrice > 0 && !expectedPricePerKg) {
        const unit = selectedMandiPrice.unit ?? "";
        const isPerQuintal =
          unit.toLowerCase().includes("quintal") ||
          unit.toLowerCase().includes("qtl");
        const pricePerKg = isPerQuintal
          ? selectedMandiPrice.modalPrice / 100
          : selectedMandiPrice.modalPrice;
        setExpectedPricePerKg(pricePerKg.toFixed(2));
      }
    }
  }, [selectedMandiPrice, district, expectedPricePerKg]);

  // Computed total quantity in kg for backend persistence
  const computedQuantityKg = useMemo(() => {
    const num = Number(quantity);
    if (!isFinite(num) || num <= 0) return 0;
    return quantityUnit === "quintal" ? num * 100 : num;
  }, [quantity, quantityUnit]);

  // Debounced (200ms) snapshot of the form used by the live-preview panel
  const [debounced, setDebounced] = useState({
    crop,
    quantityKg: computedQuantityKg,
    qualityGrade,
    expectedPricePerKg,
  });

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced({
        crop,
        quantityKg: computedQuantityKg,
        qualityGrade,
        expectedPricePerKg,
      });
    }, 200);
    return () => clearTimeout(id);
  }, [crop, computedQuantityKg, qualityGrade, expectedPricePerKg]);

  const preview = useMemo(() => {
    const qty = debounced.quantityKg;
    if (!debounced.crop || !isFinite(qty) || qty <= 0 || (allPrices?.length ?? 0) === 0) {
      return null;
    }
    const draftLot: FarmerLot = {
      id: "draft",
      farmerId: profile?.uid ?? "draft",
      crop: debounced.crop,
      variety: selectedMandi || "",
      quantityKg: qty,
      qualityGrade: debounced.qualityGrade,
      qualityNotes: "",
      expectedPricePerKg: Number(debounced.expectedPricePerKg) || 0,
      state: state || "Maharashtra",
      district: district || "Local",
      village: village || "",
      harvestDate: harvestDate || new Date().toISOString().slice(0, 10),
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
    state,
    district,
    village,
    harvestDate,
    selectedMandi,
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
    if (!computedQuantityKg || computedQuantityKg <= 0) {
      setError(t("farmer.createLot.errQty", "Quantity must be a positive number."));
      return;
    }
    if (!state) {
      setError("Please select a state.");
      return;
    }
    if (!district.trim()) {
      setError("Please enter your district.");
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
      const finalMandi =
        selectedMandi === "other" ? customMandi.trim() : selectedMandi;

      await createLot.mutateAsync({
        crop,
        variety: finalMandi || undefined,
        qualityGrade,
        quantityKg: computedQuantityKg,
        harvestDate,
        expectedPricePerKg: p,
        notes: notes.trim(),
        state,
        district: district.trim(),
        village: village.trim(),
        status: "active",
      } as any);

      setSuccess(true);
      setTimeout(() => {
        navigate({ to: "/farmer/lots" });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("farmer.createLot.errGeneric", "Could not publish lot. Try again.")
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
          "Publish your harvest to verified buyers and discover top-paying mandis in real time."
        )}
      >
        {t("farmer.createLot.title", "Create New Lot")}
      </FarmerSectionTitle>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Lot created and published successfully! Redirecting to your lots…</span>
        </div>
      )}

      <FarmerCard className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-2 text-emerald-800 border-b border-emerald-100 pb-3">
            <Sprout className="h-5 w-5 text-emerald-600" />
            <p className="font-bold text-base">
              {t("farmer.createLot.section", "Harvest & Crop Details")}
            </p>
          </div>

          {/* 1. Crop Selection */}
          <label className="block">
            <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
              {t("farmer.createLot.crop", "Crop / Commodity")} *
            </span>
            <select
              required
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
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

          {/* 2. Location Selection (State, District, Village) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                State *
              </span>
              <select
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
                District *
              </span>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Nashik, Pune, Kolar…"
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
                Village / Tehsil (Optional)
              </span>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Dindori, Yeola…"
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>

          {/* 3. Mandi / Market Selection with Live Agmarknet Integration */}
          {crop && (
            <div className="space-y-3 pt-1">
              <label className="block">
                <span className="block text-sm font-semibold text-emerald-950 mb-1.5 flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-emerald-600" />
                  {t("farmer.createLot.mandi", "Target Mandi / Market")}
                  <span className="text-xs font-normal text-emerald-700">
                    {state ? `(${state} official data)` : ""}
                  </span>
                </span>

                {isCropPricesLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-emerald-900/60">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Loading verified Agmarknet mandis…</span>
                  </div>
                ) : (
                  <select
                    value={selectedMandi}
                    onChange={(e) => setSelectedMandi(e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select market for pricing reference…</option>
                    {availableMandis.map((m) => (
                      <option key={m.id} value={m.market}>
                        {m.market} ({m.district || m.state})
                        {m.modalPrice > 0
                          ? ` — Modal: ₹${m.modalPrice.toLocaleString("en-IN")}/${m.unit}`
                          : ""}
                      </option>
                    ))}
                    <option value="other">Other / Local Mandi (Type manually)</option>
                  </select>
                )}
              </label>

              {selectedMandi === "other" && (
                <label className="block animate-in fade-in">
                  <span className="block text-xs font-semibold text-emerald-900/70 mb-1">
                    Enter Local Mandi Name
                  </span>
                  <input
                    type="text"
                    value={customMandi}
                    onChange={(e) => setCustomMandi(e.target.value)}
                    placeholder="e.g. Pimpalgaon APMC"
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              )}

              {/* Live verified Agmarknet price card */}
              {selectedMandiPrice && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                        Verified Mandi Market Data
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {selectedMandiPrice.source?.toUpperCase() || "AGMARKNET"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                      <p className="text-[10px] uppercase font-semibold text-emerald-900/60">Min Price</p>
                      <p className="font-bold text-emerald-900 text-sm">
                        {selectedMandiPrice.minPrice > 0
                          ? `₹${selectedMandiPrice.minPrice.toLocaleString("en-IN")}`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">{selectedMandiPrice.unit}</p>
                    </div>

                    <div className="bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-200">
                      <p className="text-[10px] uppercase font-semibold text-emerald-800">Modal Price</p>
                      <p className="font-bold text-emerald-950 text-base">
                        {selectedMandiPrice.modalPrice > 0
                          ? `₹${selectedMandiPrice.modalPrice.toLocaleString("en-IN")}`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-emerald-800/70">{selectedMandiPrice.unit}</p>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                      <p className="text-[10px] uppercase font-semibold text-emerald-900/60">Max Price</p>
                      <p className="font-bold text-emerald-900 text-sm">
                        {selectedMandiPrice.maxPrice > 0
                          ? `₹${selectedMandiPrice.maxPrice.toLocaleString("en-IN")}`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">{selectedMandiPrice.unit}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-emerald-900/60 mt-3 pt-2 border-t border-emerald-100">
                    <span>
                      Auction Date: <strong>{selectedMandiPrice.arrivalDate || "Latest available"}</strong>
                    </span>
                    {selectedMandiPrice.isAggregate && (
                      <span className="text-amber-700 font-medium">State Aggregate Benchmark</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Quantity & Quality Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
                {t("farmer.createLot.quantity", "Harvest Quantity")} *
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value as "quintal" | "kg")}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="quintal">Quintals (qtl)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
              </div>
              {quantity && quantityUnit === "quintal" && (
                <p className="text-[11px] text-emerald-900/60 mt-1">
                  = {(Number(quantity) * 100).toLocaleString("en-IN")} kg
                </p>
              )}
            </div>

            <label className="block">
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                {t("farmer.createLot.grade", "Quality Grade")}
              </span>
              <select
                value={qualityGrade}
                onChange={(e) => setQualityGrade(e.target.value as QualityGrade)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="A">Grade A — Premium / Export Quality</option>
                <option value="B">Grade B — Standard Commercial Grade</option>
                <option value="C">Grade C — Fair Average Quality (FAQ)</option>
              </select>
            </label>
          </div>

          {/* 5. Harvest Date & Expected Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                {t("farmer.createLot.harvestDate", "Harvest / Availability Date")} *
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
              <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
                {t("farmer.createLot.expectedPrice", "Expected Price (₹/kg)")} *
              </span>
              <input
                type="number"
                required
                min={0.1}
                step="0.25"
                value={expectedPricePerKg}
                onChange={(e) => setExpectedPricePerKg(e.target.value)}
                placeholder="e.g. 24.50"
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {expectedPricePerKg && Number(expectedPricePerKg) > 0 && (
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  ≈ ₹{(Number(expectedPricePerKg) * 100).toLocaleString("en-IN")}/quintal
                </p>
              )}
            </label>
          </div>

          {/* 6. Notes */}
          <label className="block">
            <span className="block text-sm font-semibold text-emerald-950 mb-1.5">
              {t("farmer.createLot.notes", "Notes & Certifications (Optional)")}
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Organic certified, sorted, dry storage…"
            />
          </label>

          <button
            type="submit"
            disabled={isBusy || isProfileLoading || success}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-6 py-3 hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md shadow-emerald-700/20"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBusy
              ? t("farmer.createLot.submitting", "Publishing…")
              : success
              ? "Lot Created!"
              : t("farmer.createLot.submit", "Create & Publish Lot")}
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </FarmerCard>

      {/* Live Preview Panel — Market Intelligence */}
      <FarmerCard className="p-5 bg-gradient-to-br from-sky-50/60 via-white to-emerald-50/60">
        <FarmerSectionTitle
          hint={t(
            "farmer.createLot.previewHint",
            "Updates dynamically as you configure your harvest."
          )}
          action={
            preview?.price?.source ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                {preview.price.source.toUpperCase()}
              </span>
            ) : null
          }
        >
          {t("farmer.createLot.previewTitle", "Market Value Live Estimation")}
        </FarmerSectionTitle>

        {!preview ? (
          <p className="text-sm text-emerald-900/60 py-2">
            Select crop and quantity to view fair value and recommended buyer match.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <PreviewStat
                icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                label={t("farmer.createLot.previewNet", "Estimated Value")}
                value={formatRupees(preview.realisable.net)}
              />
              <PreviewStat
                icon={<Store className="h-4 w-4 text-sky-600" />}
                label={t("farmer.createLot.previewBestMarket", "Top Market")}
                value={preview.price.market}
              />
              <PreviewStat
                icon={<Award className="h-4 w-4 text-amber-600" />}
                label={t("farmer.createLot.previewScore", "Match Score")}
                value={`${preview.score}/100`}
              />
              <PreviewStat
                icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
                label={t("farmer.createLot.previewReliability", "Reliability")}
                value={
                  previewBuyerReliability?.suppressed
                    ? "—"
                    : previewBuyerReliability?.score != null
                    ? `${previewBuyerReliability.score}/100`
                    : "High"
                }
              />
            </div>

            <div className="text-xs text-emerald-900/70 pt-2 border-t border-emerald-100/60">
              <span className="font-semibold text-emerald-900">
                {t("farmer.createLot.previewBuyer", "Commercial Buyer Interest")}:
              </span>{" "}
              {preview.buyer ? preview.buyer.name : "Active regional aggregators available"}
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
    <div className="flex flex-col gap-0.5 bg-white/70 p-3 rounded-xl border border-emerald-100/70">
      <div className="flex items-center gap-1.5 text-emerald-800">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
          {label}
        </span>
      </div>
      <span className="text-sm font-bold text-emerald-950 break-words mt-1">
        {value}
      </span>
    </div>
  );
}
