/**
 * PHASE 1 §P3.9 — Market-data reliability surface.
 *
 * Surfaces the per-source reliability score (0..100, from
 * `GET /api/market-prices/reliability`) to the farmer-facing UI
 * alongside the price/recommendation surfaces.
 *
 * Band rules (A/B/C/D):
 *   A — Excellent (80+)  → emerald
 *   B — Good (60–79)     → sky
 *   C — Fair (40–59)     → amber
 *   D — Limited (0–39)   → rose
 *
 * Strict rules:
 *   • Never silence a low score.
 *   • Never fabricate a band; if data is unavailable, render `null`.
 *   • No predictions, no scraping, no AI.
 */

import { useTranslation } from "@/locales";
import { useMarketReliability } from "@/features/farmerDashboard/hooks/data";
import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Band helpers ──────────────────────────────────────────────────────

export type ReliabilityBand = "A" | "B" | "C" | "D";

export const bandForScore = (score: number): ReliabilityBand => {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
};

export const bandLabel = (band: ReliabilityBand): string => {
  switch (band) {
    case "A":
      return "Excellent";
    case "B":
      return "Good";
    case "C":
      return "Fair";
    case "D":
      return "Limited data";
  }
};

export const bandClass = (band: ReliabilityBand): string => {
  switch (band) {
    case "A":
      return "bg-emerald-100 text-emerald-800";
    case "B":
      return "bg-sky-100 text-sky-800";
    case "C":
      return "bg-amber-100 text-amber-800";
    case "D":
      return "bg-rose-100 text-rose-800";
  }
};

const BandIcon = ({ band }: { band: ReliabilityBand }) => {
  switch (band) {
    case "A":
      return <CircleCheck className="h-3 w-3" />;
    case "B":
      return <CircleDot className="h-3 w-3" />;
    case "C":
      return <CircleAlert className="h-3 w-3" />;
    case "D":
    default:
      return <CircleX className="h-3 w-3" />;
  }
};

// ─── Chip ──────────────────────────────────────────────────────────────

/**
 * Small inline badge showing the reliability for a single source.
 *
 * If the hook is loading or returns no snapshot for `source`, the badge
 * does NOT render a misleading "perfect" value — it renders `null` so
 * the parent can show its own "loading" affordance.
 */
export function ReliabilityChip({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const { data } = useMarketReliability(source);
  const snap = (data ?? []).find((s) => s.source === source);
  if (!snap) return null;
  const band = bandForScore(snap.score);
  return (
    <span
      data-testid={`reliability-chip-${source}`}
      data-band={band}
      data-score={snap.score}
      title={`${bandLabel(band)} — score ${snap.score}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        bandClass(band),
        className,
      )}
    >
      <BandIcon band={band} />
      <span>{bandLabel(band)}</span>
      <span className="opacity-60">·</span>
      <span>{snap.score}</span>
    </span>
  );
}

// ─── Footer (per-source strip) ────────────────────────────────────────

/**
 * Full per-source strip — used at the bottom of the MarketPricesPage so
 * the farmer can see WHICH sources are good / bad. Never hides scores.
 */
export function ReliabilityFooter({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useMarketReliability();
  if (isLoading && !data) {
    return (
      <p
        className={cn("text-xs text-emerald-900/50 text-center", className)}
      >
        {t("farmer.reliability.loading", "Checking source reliability…")}
      </p>
    );
  }
  const snapshots = data ?? [];
  if (snapshots.length === 0) return null;
  return (
    <div
      data-testid="reliability-footer"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 text-xs",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-emerald-900/70">
        <Shield className="h-3 w-3" />
        {t("farmer.reliability.label", "Data source health:")}
      </span>
      {snapshots.map((s) => {
        const band = bandForScore(s.score);
        return (
          <span
            key={s.source}
            data-testid={`reliability-footer-${s.source}`}
            data-band={band}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              bandClass(band),
            )}
            title={`${bandLabel(band)} — score ${s.score}`}
          >
            <BandIcon band={band} />
            <span className="uppercase tracking-wider">{s.source}</span>
            <span className="opacity-60">·</span>
            <span>{s.score}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Soft-warning banner ───────────────────────────────────────────────

/**
 * Renders a soft warning when the lowest active source reliability is
 * below `threshold`. Default = 60 (below band "B").
 *
 * The banner is consciously NOT destructive — it tells the farmer to
 * treat today's prices with extra caution without invalidating them.
 */
export function LowReliabilityBanner({
  threshold = 60,
  className,
}: {
  threshold?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data } = useMarketReliability();
  const snapshots = data ?? [];
  if (snapshots.length === 0) return null;
  const weakest = snapshots.reduce((min, s) =>
    s.score < min.score ? s : min,
  snapshots[0]);
  if (weakest.score >= threshold) return null;
  const band = bandForScore(weakest.score);
  return (
    <div
      data-testid="low-reliability-banner"
      data-band={band}
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900",
        className,
      )}
    >
      <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">
          {t(
            "farmer.reliability.lowWarningTitle",
            "Live data from one or more sources is below the freshness threshold.",
          )}
        </p>
        <p className="text-amber-900/80 mt-0.5 text-xs">
          {t(
            "farmer.reliability.lowWarningBody",
            "Weakest source: {source} scored {score}/100 ({band}). Treat today's modal prices as indicative only and verify with your local mandi before committing.",
            {
              source: weakest.source,
              score: String(weakest.score),
              band: bandLabel(band),
            },
          )}
        </p>
      </div>
    </div>
  );
}
