import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Plus, X, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useGrievances,
  useCreateGrievance,
} from "@/features/farmerDashboard/hooks/data";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

const CATEGORY_KEYS = [
  "weight",
  "payment",
  "quality",
  "logistics",
  "other",
] as const;

const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;

export function GrievancesPage() {
  const { t } = useTranslation();
  const { data: grievances } = useGrievances();
  const create = useCreateGrievance();
  const search = useSearch({ from: "/farmer/grievances" });
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>(
    "payment"
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>(
    "medium"
  );
  const [transactionRef, setTransactionRef] = useState("");

  // Market intelligence — auto-open & prefill when arriving via
  // /farmer/grievances?prefill=payment&ref=<paymentId>
  useEffect(() => {
    if (search?.prefill === "payment" && search?.ref) {
      setOpen(true);
      setCategory("payment");
      setTransactionRef(search.ref);
      setSubject(
        t("farmer.grievances.prefilledFrom", "Prefilled from payment " + search.ref),
      );
    }
  }, [search?.prefill, search?.ref, t]);

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) {
      setError(t("farmer.grievances.errSubject", "Subject is required."));
      return;
    }
    if (subject.trim().length < 5) {
      setError(t("farmer.grievances.errSubjectShort", "Subject must be at least 5 characters."));
      return;
    }
    if (!description.trim()) {
      setError(t("farmer.grievances.errDesc", "Description is required."));
      return;
    }
    if (description.trim().length < 15) {
      setError(t("farmer.grievances.errDescShort", "Please describe the issue in at least 15 characters."));
      return;
    }
    try {
      await create.mutateAsync({
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        transactionRef: transactionRef.trim(),
      });
      setSubject("");
      setDescription("");
      setTransactionRef("");
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("farmer.grievances.errGeneric", "Could not submit. Try again."),
      );
    }
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <FarmerSectionTitle
        hint={t(
          "farmer.grievances.hint",
          "Track dispute status and raise new grievances."
        )}
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white text-sm font-semibold px-3 py-2 hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("farmer.grievances.new", "New Grievance")}
          </button>
        }
      >
        {t("farmer.grievances.title", "Grievances")}
      </FarmerSectionTitle>

      {(grievances ?? []).length === 0 ? (
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.grievances.empty", "No grievances raised yet.")}
        </FarmerCard>
      ) : (
        <div className="space-y-3">
          {(grievances ?? []).map((g) => (
            <FarmerCard key={g.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-900 truncate">
                        {g.subject}
                      </p>
                      <p className="text-xs text-emerald-900/60 truncate">
                        {g.category} • {formatDate(g.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          g.status === "open" && "bg-amber-100 text-amber-800",
                          g.status === "in_review" && "bg-sky-100 text-sky-800",
                          g.status === "resolved" && "bg-emerald-100 text-emerald-800",
                          g.status === "rejected" && "bg-rose-100 text-rose-800"
                        )}
                      >
                        {g.status}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          g.priority === "high" && "bg-rose-50 text-rose-700",
                          g.priority === "medium" && "bg-amber-50 text-amber-700",
                          g.priority === "low" && "bg-stone-100 text-stone-700"
                        )}
                      >
                        {g.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-900/80 mt-2 leading-relaxed">
                    {g.description}
                  </p>
                </div>
              </div>
            </FarmerCard>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <FarmerCard className="w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-emerald-900">
                {t("farmer.grievances.formTitle", "Raise a grievance")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-emerald-900/60 hover:text-emerald-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-emerald-900 mb-1">
                    {t("farmer.grievances.category", "Category")}
                  </span>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as typeof category)
                    }
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORY_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {t(`farmer.grievances.categories.${c}`, c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-emerald-900 mb-1">
                    {t("farmer.grievances.priority", "Priority")}
                  </span>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as typeof priority)
                    }
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {t(`farmer.grievances.priorities.${p}`, p)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">
                  {t("farmer.grievances.subject", "Subject")}
                </span>
                <input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-emerald-900 mb-1">
                  {t("farmer.grievances.description", "Description")}
                </span>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-200"
                >
                  {t("farmer.common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t("farmer.grievances.submit", "Submit")}
                </button>
              </div>
              {error && (
                <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </form>
          </FarmerCard>
        </div>
      )}
    </FarmerPageContainer>
  );
}
