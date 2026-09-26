import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  MessageCircleWarning,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { usePayments } from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { DataStateBadge } from "@/features/farmerDashboard/DataStateBadge";
import { formatDate, formatRupees } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "paid", "pending", "failed"] as const;
type Filter = (typeof FILTERS)[number];

export function PaymentsPage() {
  const { t } = useTranslation();
  const { data: payments } = usePayments();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = (payments ?? []).filter((p) =>
    filter === "all" ? true : p.status === filter
  );

  const totals = (payments ?? []).reduce(
    (acc, p) => {
      if (p.status === "paid") acc.paid += p.amount;
      if (p.status === "pending") acc.pending += p.amount;
      return acc;
    },
    { paid: 0, pending: 0 }
  );

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t("farmer.payments.hint", "Every payment you have received or are awaiting.")}
        action={<DataStateBadge items={payments} />}
      >
        {t("farmer.payments.title", "Payments")}
      </FarmerSectionTitle>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <FarmerCard className="p-4 bg-emerald-50/50">
          <p className="text-xs text-emerald-900/70">
            {t("farmer.payments.totalReceived", "Total received")}
          </p>
          <p className="text-2xl font-extrabold text-emerald-900">
            {formatRupees(totals.paid)}
          </p>
        </FarmerCard>
        <FarmerCard className="p-4 bg-amber-50/50">
          <p className="text-xs text-emerald-900/70">
            {t("farmer.payments.totalPending", "Pending")}
          </p>
          <p className="text-2xl font-extrabold text-amber-800">
            {formatRupees(totals.pending)}
          </p>
        </FarmerCard>
      </div>

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
              {t(`farmer.payments.filter.${f}`, f)}
            </button>
          ))}
        </div>
      </FarmerCard>

      {visible.length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.payments.empty", "No payments in this view yet.")}
        </FarmerCard>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <FarmerCard key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    p.status === "paid" && "bg-emerald-100 text-emerald-700",
                    p.status === "pending" && "bg-amber-100 text-amber-700",
                    p.status === "failed" && "bg-rose-100 text-rose-700"
                  )}
                >
                  {p.status === "paid" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : p.status === "pending" ? (
                    <Clock className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900 truncate">
                        {p.buyerName}
                      </p>
                      <p className="text-xs text-emerald-900/60 truncate">
                        {p.lotSummary}
                      </p>
                    </div>
                    <p className="text-lg font-extrabold text-emerald-900 shrink-0">
                      {formatRupees(p.amount)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-emerald-900/60">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(p.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {p.method}
                    </span>
                  </div>
                  {p.timeline.length > 0 && (
                    <ol className="mt-3 border-l-2 border-emerald-200 pl-3 space-y-1">
                      {p.timeline.map((ev, idx) => (
                        <li key={idx} className="text-xs">
                          <span className="font-semibold text-emerald-900">
                            {ev.label}
                          </span>
                          <span className="text-emerald-900/50 ml-1">
                            • {formatDate(ev.at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {/* Raise dispute — market intelligence cross-screen deep link */}
                  {p.status !== "paid" ? (
                    <div className="mt-2">
                      <Link
                        to="/farmer/grievances"
                        search={{
                          prefill: "payment",
                          ref: p.reference,
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 px-2.5 py-1.5 hover:bg-rose-100"
                      >
                        <MessageCircleWarning className="h-3 w-3" />
                        {t("farmer.payments.raiseDispute", "Raise dispute")}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </FarmerCard>
          ))}
        </div>
      )}
    </FarmerPageContainer>
  );
}
