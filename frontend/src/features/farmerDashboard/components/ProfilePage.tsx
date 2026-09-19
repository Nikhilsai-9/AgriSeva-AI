import { useState } from "react";
import { User, MapPin, Save } from "lucide-react";
import { useTranslation } from "@/locales";
import { useAuthStore } from "@/stores/auth-store";
import {
  useFarmerProfile,
  useUpdateFarmerProfile,
} from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { INDIAN_STATES } from "@/features/farmerDashboard/types";

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: profile } = useFarmerProfile();
  const update = useUpdateFarmerProfile();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [stateName, setStateName] = useState(profile?.state ?? "");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [village, setVillage] = useState(profile?.village ?? "");
  const [primaryCrop, setPrimaryCrop] = useState(
    profile?.primaryCrops?.[0] ?? ""
  );
  const [savedHint, setSavedHint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validatePhone(value: string): boolean {
    if (!value) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || digits.length === 12 || digits.length === 13;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("farmer.profile.errName", "Name is required."));
      return;
    }
    if (!validatePhone(phone)) {
      setError(t("farmer.profile.errPhone", "Phone must be 10 digits (with optional 91 prefix)."));
      return;
    }
    if (!stateName) {
      setError(t("farmer.profile.errState", "Select your state."));
      return;
    }
    if (!district.trim()) {
      setError(t("farmer.profile.errDistrict", "District is required."));
      return;
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        state: stateName,
        district: district.trim(),
        village: village.trim(),
        primaryCrop: primaryCrop.trim(),
      });
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("farmer.profile.errGeneric", "Could not save. Try again."),
      );
    }
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.profile.hint", "Your details power buyer matching and lot location.")}
      >
        {t("farmer.profile.title", "My Profile")}
      </FarmerSectionTitle>

      <FarmerCard className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <User className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-bold text-emerald-900">
              {profile?.name ?? user?.name ?? "Farmer"}
            </p>
            <p className="text-xs text-emerald-900/60">
              {profile?.phone ?? user?.email ?? ""}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.profile.name", "Name")}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.profile.phone", "Phone")}
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-emerald-900 mb-1">
              {t("farmer.profile.primaryCrop", "Primary crop")}
            </span>
            <input
              value={primaryCrop}
              onChange={(e) => setPrimaryCrop(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Tomato"
            />
          </label>

          <div className="flex items-center gap-1 text-xs text-emerald-900/70 mt-1">
            <MapPin className="h-3 w-3" />
            {t("farmer.profile.location", "Location")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-emerald-900 mb-1">
                {t("farmer.profile.state", "State")}
              </span>
              <select
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-emerald-900 mb-1">
                {t("farmer.profile.district", "District")}
              </span>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-emerald-900 mb-1">
              {t("farmer.profile.village", "Village")}
            </span>
            <input
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={update.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {t("farmer.profile.save", "Save profile")}
            </button>
            {savedHint && (
              <span className="text-xs font-semibold text-emerald-700">
                {t("farmer.profile.saved", "✓ Saved")}
              </span>
            )}
          </div>
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>
      </FarmerCard>
    </FarmerPageContainer>
  );
}
