/**
 * Farmer Dashboard — pure utility helpers.
 *
 * No external dependencies. Designed for the new dashboard in isolation.
 */

export const formatRupees = (amount: number): string => {
  if (!isFinite(amount)) return "—";
  // Indian numbering system (lakhs/crores)
  return "₹ " + Math.round(amount).toLocaleString("en-IN");
};

export const formatRupeesPerKg = (amount: number): string => {
  if (!isFinite(amount)) return "—";
  return "₹ " + amount.toFixed(2) + " /kg";
};

export const formatRupeesPerQuintal = (amount: number): string => {
  if (!isFinite(amount)) return "—";
  return "₹ " + amount.toLocaleString("en-IN") + " /quintal";
};

export const formatKg = (kg: number): string => {
  if (!isFinite(kg)) return "—";
  if (kg >= 1000) return (kg / 1000).toFixed(1) + " tonnes";
  return kg + " kg";
};

export const formatDistance = (km: number | undefined): string => {
  if (km === undefined || km === null) return "—";
  return km + " km";
};

export const formatTrend = (pct: number | undefined): string => {
  if (pct === undefined || pct === null) return "—";
  if (pct === 0) return "0%";
  return (pct > 0 ? "+" : "") + pct + "%";
};

export const trendBadgeClass = (pct: number | undefined): string => {
  if (pct === undefined || pct === null) return "bg-muted text-muted-foreground";
  if (pct > 0) return "bg-emerald-100 text-emerald-700";
  if (pct < 0) return "bg-rose-100 text-rose-700";
  return "bg-muted text-muted-foreground";
};

export const trendArrow = (pct: number | undefined): string => {
  if (pct === undefined || pct === null) return "→";
  if (pct > 0) return "↑";
  if (pct < 0) return "↓";
  return "→";
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const greetingForNow = (): {
  key: "morning" | "afternoon" | "evening" | "night";
} => {
  const h = new Date().getHours();
  if (h < 5) return { key: "night" };
  if (h < 12) return { key: "morning" };
  if (h < 17) return { key: "afternoon" };
  if (h < 21) return { key: "evening" };
  return { key: "night" };
};
