import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Sprout } from "lucide-react";
import { useTranslation } from "@/locales";
import { useFarmerProfile, useCreateLot } from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { COMMODITIES } from "@/features/farmerDashboard/types";

export function CreateLotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile } = useFarmerProfile();
  const createLot = useCreateLot();

  const [crop, setCrop] = useState("");
  const [qualityGrade, setQualityGrade] = useState("A");
  const [quantityKg, setQuantityKg] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [expectedPricePerKg, setExpectedPricePerKg] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!crop || !quantityKg || !harvestDate || !expectedPricePerKg) return;
    const lot = await createLot.mutateAsync({
      crop,
      qualityGrade,
      quantityKg: Number(quantityKg),
      harvestDate,
      expectedPricePerKg: Number(expectedPricePerKg),
      notes: notes.trim(),
      state: profile?.state ?? "Maharashtra",
      district: profile?.district ?? "Pune",
    });
    navigate({ to: "/farmer/lots/$lotId", params: { lotId: lot.id } });
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
                <option key={c.value} value={c.label}>
                  {c.label}
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
                onChange={(e) => setQualityGrade(e.target.value)}
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
        </form>
      </FarmerCard>
    </FarmerPageContainer>
  );
}
