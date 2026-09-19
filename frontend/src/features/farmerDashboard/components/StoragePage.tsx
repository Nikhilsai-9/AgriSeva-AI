import { useMemo, useState } from "react";
import {
  Warehouse,
  Snowflake,
  MapPin,
  Thermometer,
  X,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useStorage,
  useReserveStorage,
  useStorageBookings,
  useMyLots,
} from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { cn } from "@/lib/utils";
import { formatKg } from "@/features/farmerDashboard/hooks/utils";

export function StoragePage() {
  const { t } = useTranslation();
  const { data: options } = useStorage();
  const { data: bookings } = useStorageBookings();
  const { data: lots } = useMyLots();
  const reserve = useReserveStorage();

  const [openId, setOpenId] = useState<string | null>(null);
  const [reservedKg, setReservedKg] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("7");
  const [lotId, setLotId] = useState<string>("");
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeLots = (lots ?? []).filter((l) => l.status === "active");
  const bookedStorageIds = useMemo(
    () => new Set((bookings ?? []).map((b) => b.storageId)),
    [bookings],
  );

  async function handleReserve(
    storageId: string,
    storageName: string,
    type: "warehouse" | "cold" | "silo",
  ) {
    setError(null);
    const kg = Number(reservedKg);
    const days = Number(durationDays);
    if (!isFinite(kg) || kg <= 0) {
      setError(t("farmer.storage.errKg", "Enter a positive quantity."));
      return;
    }
    if (!isFinite(days) || days <= 0) {
      setError(t("farmer.storage.errDays", "Enter a positive duration."));
      return;
    }
    const lot = activeLots.find((l) => l.id === lotId);
    try {
      await reserve.mutateAsync({
        storageId,
        storageName,
        storageType: type,
        reservedKg: kg,
        durationDays: days,
        lotId: lot ? lot.id : null,
        lotSummary: lot ? `${lot.crop} - ${formatKg(lot.quantityKg)}` : "General storage",
      });
      setLastBookingId(storageId);
      setOpenId(null);
      setReservedKg("");
      setDurationDays("7");
      setLotId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("farmer.storage.errGeneric", "Could not reserve. Try again."));
    }
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.storage.hint", "Cold storage and warehousing facilities near your farm. Demo dataset.")}
        action={<span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Demo</span>}
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
            const justBooked = lastBookingId === s.id;
            return (
              <FarmerCard key={s.id} className="p-4 sm:p-5 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      s.type === "cold" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {s.type === "cold" ? <Snowflake className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate">{s.name}</p>
                    <p className="text-xs text-emerald-900/60 truncate">
                      {s.type === "cold" ? t("farmer.storage.cold", "Cold storage") : t("farmer.storage.warehouse", "Warehouse")}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {s.location}
                </p>
                {s.temperatureC != null && (
                  <p className="text-xs text-emerald-900/70 flex items-center gap-1">
                    <Thermometer className="h-3 w-3" /> {s.temperatureC}-C
                  </p>
                )}
                <div className="mt-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-emerald-900/70">{t("farmer.storage.occupancy", "Occupancy")}</span>
                    <span className={cn("font-semibold", full ? "text-rose-700" : "text-emerald-800")}>
                      {occupancy.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className={cn("h-full rounded-full", full ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${Math.min(occupancy, 100)}%` }} />
                  </div>
                </div>
                <p className="text-xs text-emerald-900/70 mt-1">
                  {t("farmer.storage.available", "Available")}: <span className="font-semibold text-emerald-900">{(s.capacityKg - s.usedKg).toLocaleString("en-IN")} kg</span>
                </p>
                {justBooked && (
                  <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {t("farmer.storage.booked", "Reserved")}
                  </p>
                )}
                {bookedStorageIds.has(s.id) && !justBooked && (
                  <p className="text-[11px] font-semibold text-sky-700">
                    {t("farmer.storage.youHaveBooking", "You have an active reservation")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={full}
                  onClick={() => { setOpenId(s.id); setLastBookingId(null); setError(null); }}
                  className="mt-1 inline-flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold px-3 py-2 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {full ? t("farmer.storage.full", "Full") : t("farmer.storage.book", "Reserve space")}
                </button>
              </FarmerCard>
            );
          })}
        </div>
      )}
      {(bookings ?? []).length > 0 && (
        <>
          <FarmerSectionTitle hint={t("farmer.storage.bookingsHint", "Your active reservations")}>
            {t("farmer.storage.bookings", "My Reservations")}
          </FarmerSectionTitle>
          <div className="space-y-2">
            {(bookings ?? []).map((b) => (
              <FarmerCard key={b.id} className="p-3 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Warehouse className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-emerald-900 truncate">{b.storageName}</p>
                  <p className="text-xs text-emerald-900/60 truncate">
                    {b.lotSummary} - {b.reservedKg}kg - {b.durationDays} days - arrival {b.expectedArrival}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{b.status}</span>
              </FarmerCard>
            ))}
          </div>
        </>
      )}
      {openId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-emerald-900">{t("farmer.storage.reserveTitle", "Reserve storage")}</p>
              <button type="button" onClick={() => setOpenId(null)} className="text-emerald-900/60 hover:text-emerald-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = (options ?? []).find((o) => o.id === openId);
                if (target) handleReserve(target.id, target.name, target.type);
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.storage.fieldKg", "Quantity (kg)")}</span>
                <input type="number" min={1} required value={reservedKg} onChange={(e) => setReservedKg(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="500" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.storage.fieldDays", "Duration (days)")}</span>
                <input type="number" min={1} required value={durationDays} onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">{t("farmer.storage.fieldLot", "Optional lot")}</span>
                <select value={lotId} onChange={(e) => setLotId(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">-</option>
                  {activeLots.map((l) => (
                    <option key={l.id} value={l.id}>{l.crop} - {formatKg(l.quantityKg)}</option>
                  ))}
                </select>
              </label>
              {error && (
                <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpenId(null)}
                  className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200">
                  {t("farmer.common.cancel", "Cancel")}
                </button>
                <button type="submit" disabled={reserve.isPending}
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50">
                  {reserve.isPending ? t("farmer.common.submitting", "Submitting...") : t("farmer.storage.confirmReserve", "Reserve")}
                </button>
              </div>
            </form>
          </FarmerCard>
        </div>
      )}
    </FarmerPageContainer>
  );
}
