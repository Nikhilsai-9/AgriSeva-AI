import {
  Truck, MapPin, Calendar, Package, ShieldCheck, Check,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useLogisticsOptions as useLogistics,
  useSelectedLogistics,
  useFarmerDashboardStore,
} from "@/features/farmerDashboard/hooks/data";
import type { LogisticsOption } from "@/features/farmerDashboard/types";
import {
  FarmerCard, FarmerPageContainer, FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

export function LogisticsPage() {
  const { t } = useTranslation();
  const { data: options } = useLogistics();
  const { selectedId, setSelectedId } = useSelectedLogistics();
  const pushNotification = useFarmerDashboardStore((s) => s.pushNotification);
  const selected = (options ?? []).find((o) => o.id === selectedId);

  function handleSelect(opt: LogisticsOption) {
    setSelectedId(opt.id);
    pushNotification({
      id: "n-logi-" + opt.id + "-" + Date.now(),
      kind: "system",
      title: "Transporter selected",
      body: opt.provider + " - " + opt.from + " to " + opt.to,
      href: "/farmer/logistics",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.logistics.hint", "Transport options from aggregators and FPO partners. Demo dataset.")}
        action={<span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{t("farmer.common.sourceDemo", "Demo")}</span>}
      >
        {t("farmer.logistics.title", "Logistics & Transport")}
      </FarmerSectionTitle>
      {selected && (
        <FarmerCard className="p-3 bg-emerald-50/40 border-emerald-300">
          <p className="text-xs text-emerald-900">
            <Check className="inline h-3 w-3 mr-1" />
            {t("farmer.logistics.selectedHint", "Currently selected: " + selected.provider)}
          </p>
        </FarmerCard>
      )}
      {(options ?? []).length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.logistics.empty", "No logistics options available right now.")}
        </FarmerCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {((options ?? []) as LogisticsOption[]).map((opt) => {
            const isSelected = selectedId === opt.id;
            return (
              <FarmerCard
                key={opt.id}
                className={cn(
                  "p-4 sm:p-5 cursor-pointer transition-all",
                  isSelected ? "ring-2 ring-emerald-600 bg-emerald-50/40" : "hover:shadow-md"
                )}
                onClick={() => handleSelect(opt)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Truck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900 truncate">{opt.provider}</p>
                      <p className="text-xs text-emerald-900/60 truncate">{opt.vehicleType}</p>
                    </div>
                  </div>
                  {opt.insured && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                      <ShieldCheck className="h-3 w-3" />
                      {t("farmer.logistics.insured", "Insured")}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Row icon={<MapPin className="h-3 w-3" />} label={t("farmer.logistics.route", "Route")}>{opt.from} - {opt.to}</Row>
                  <Row icon={<Calendar className="h-3 w-3" />} label={t("farmer.logistics.eta", "ETA")}>{formatDate(opt.estimatedDeliveryDate)}</Row>
                  <Row icon={<Package className="h-3 w-3" />} label={t("farmer.logistics.capacity", "Capacity")}>{opt.capacityKg?.toLocaleString("en-IN") ?? 0} kg</Row>
                  <Row icon={<Truck className="h-3 w-3" />} label={t("farmer.logistics.rate", "Rate")}>Rs {opt.ratePerKg}/kg</Row>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelect(opt); }}
                  className={cn(
                    "mt-3 w-full inline-flex items-center justify-center gap-1 rounded-xl text-sm font-semibold px-4 py-2 transition-colors",
                    isSelected ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  )}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                  {isSelected ? t("farmer.logistics.selected", "Selected") : t("farmer.logistics.select", "Select this transporter")}
                </button>
              </FarmerCard>
            );
          })}
        </div>
      )}
    </FarmerPageContainer>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">{label}</p>
        <p className="text-xs font-semibold text-emerald-900 break-words">{children}</p>
      </div>
    </div>
  );
}
