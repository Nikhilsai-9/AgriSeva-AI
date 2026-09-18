import { Warehouse, Snowflake, MapPin, Thermometer } from "lucide-react";
import { useTranslation } from "@/locales";
import { useStorage } from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { cn } from "@/lib/utils";

export function StoragePage() {
  const { t } = useTranslation();
  const { data: options } = useStorage();

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.storage.hint",
          "Cold storage and warehousing facilities near your farm. Demo dataset."
        )}
        action={
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            Demo
          </span>
        }
      >
        {t("farmer.storage.title", "Storage Facilities")}
      </FarmerSectionTitle>

      {(options ?? []).length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.storage.empty", "No storage options available right now.")}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {(options ?? []).map((s) => {
            const occupancy = s.capacityKg > 0 ? (s.usedKg / s.capacityKg) * 100 : 0;
            const full = occupancy >= 90;
            return (
              <FarmerCard key={s.id} className="p-4 sm:p-5 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      s.type === "cold" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {s.type === "cold" ? (
                      <Snowflake className="h-5 w-5" />
                    ) : (
                      <Warehouse className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-emerald-900/60 truncate">
                      {s.type === "cold"
                        ? t("farmer.storage.cold", "Cold storage")
                        : t("farmer.storage.warehouse", "Warehouse")}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {s.location}
                </p>
                {s.temperatureC != null && (
                  <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    {s.temperatureC}°C
                  </p>
                )}
                <div className="mt-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-emerald-900/70">
                      {t("farmer.storage.occupancy", "Occupancy")}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        full ? "text-rose-700" : "text-emerald-800"
                      )}
                    >
                      {occupancy.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        full ? "bg-rose-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(occupancy, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-emerald-900/70 mt-1">
                  {t("farmer.storage.available", "Available")}:{" "}
                  <span className="font-semibold text-emerald-900">
                    {(s.capacityKg - s.usedKg).toLocaleString("en-IN")} kg
                  </span>
                </p>
                <button
                  type="button"
                  disabled={full}
                  className="mt-1 inline-flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold px-3 py-2 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {full
                    ? t("farmer.storage.full", "Full")
                    : t("farmer.storage.book", "Reserve space")}
                </button>
              </FarmerCard>
            );
          })}
        </div>
      )}
    </FarmerPageContainer>
  );
}
