/**
 * DataStateBadge — honest provenance badge for any farmer-dashboard list.
 *
 * PHASE 3 §P3.A — replaces the static "Demo" badge that previously lived
 * on the Buyers / Payments / Logistics / Storage pages. The previous
 * badge was hardcoded so it always read "Demo" even when a real farmer
 * had signed in and created real lots, real offers, real payments.
 *
 * The new badge is driven by `classifyDemoState(items)` which inspects
 * the per-record `isDemo` flag the backend already attaches to every
 * record. Five possible states:
 *
 *   - "empty"     → no records: render nothing (the page shows its own empty state)
 *   - "all_demo"  → every record is demo: amber "Demo Data" badge
 *   - "mixed"     → some demo + some real: amber "Mixed (Demo + Real)" badge
 *   - "all_real"  → every record is real: emerald "Live Data" badge
 *   - "loading"   → no data yet (query hasn't resolved): nothing
 */

import { useTranslation } from "@/locales";
import { cn } from "@/lib/utils";
import {
  classifyDemoState,
  type DemoDataState,
} from "./dataState";

export interface DataStateBadgeProps<T extends { isDemo?: boolean }> {
  items: T[] | null | undefined;
  /** Optional override; useful for the "loading" case from the caller. */
  state?: DemoDataState;
  className?: string;
}

export function DataStateBadge<T extends { isDemo?: boolean }>({
  items,
  state,
  className,
}: DataStateBadgeProps<T>) {
  const { t } = useTranslation();
  const computed = state ?? classifyDemoState(items);

  if (computed === "empty" || computed === "all_real") {
    // "all_real" is the default expectation once the catalogue is real;
    // we deliberately do NOT surface a green "Live" badge on every page
    // because that would be noisy. The page-level source label (e.g. the
    // "AGMARKNET" / "eNAM" chip on Market Prices) is the source of truth.
    return null;
  }

  const label = (() => {
    switch (computed) {
      case "all_demo":
        return t("farmer.common.sourceDemo", "Demo Data");
      case "mixed":
        return t(
          "farmer.common.sourceMixed",
          "Mixed — some demo records present",
        );
      default:
        return "";
    }
  })();

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
        computed === "all_demo" &&
          "bg-amber-100 text-amber-800 border border-amber-200",
        computed === "mixed" &&
          "bg-orange-100 text-orange-900 border border-orange-300",
        className,
      )}
      data-demo-state={computed}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full",
          computed === "all_demo" && "bg-amber-600",
          computed === "mixed" && "bg-orange-600",
        )}
      />
      {label}
    </span>
  );
}
