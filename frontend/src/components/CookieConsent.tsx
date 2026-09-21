import { useEffect, useState, useCallback } from "react";
import { Cookie, Settings2, ShieldCheck, BarChart3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/locales";

/**
 * GDPR / India DPDP-style consent banner for the AgriSeva-AI frontend.
 *
 * Why: the frontend bundles Firebase Analytics (`getAnalytics` is called at
 * module load in `src/lib/firebase.ts`). Firebase Analytics drops non-essential
 * cookies (_ga, _gid) on first visit. To stay compliant with applicable
 * privacy law, we present a banner and only call `analytics.setConsent({...})`
 * once the user makes a choice. The banner is rendered once per browser via
 * localStorage and is keyboard- and screen-reader-friendly.
 *
 * Defaults: opted-OUT until the user accepts. Firebase Analytics is allowed
 * to run with `analytics_enabled = false` so no cookies are set initially.
 */

type ConsentState = "unknown" | "accepted" | "rejected";
const KEY = "agriseva.cookieConsent.v1";

function readStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "accepted" || raw === "rejected") return raw;
  } catch {
    /* localStorage may be unavailable (e.g. Safari private mode). */
  }
  return "unknown";
}

function writeStoredConsent(value: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    if (value === "unknown") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

async function applyAnalyticsConsent(state: Exclude<ConsentState, "unknown">) {
  try {
    const mod = await import("@/lib/firebase");
    const a = mod.analytics;
    if (a) {
      // Lazy import so it doesn't break in environments without Analytics.
      // The global `gtag` is the runtime that enforces these settings.
      const gtag = (window as unknown as { gtag?: (cmd: string, ...args: unknown[]) => void }).gtag;
      if (typeof gtag === "function") {
        gtag("consent", "update", {
          analytics_storage: state === "accepted" ? "granted" : "denied",
          ad_storage: "denied", // we don't run ad personalization
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
      }
    }
  } catch {
    /* analytics may not be configured \u2014 silently no-op */
  }
}
export function CookieConsent() {
  const { t } = useTranslation();
  const [state, setState] = useState<ConsentState>("unknown");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setState(readStoredConsent());
  }, []);

  const accept = useCallback(() => {
    setState("accepted");
    writeStoredConsent("accepted");
    void applyAnalyticsConsent("accepted");
  }, []);

  const reject = useCallback(() => {
    setState("rejected");
    writeStoredConsent("rejected");
    void applyAnalyticsConsent("rejected");
  }, []);

  if (state !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 z-50 max-w-3xl mx-auto rounded-2xl border border-emerald-200 bg-white shadow-2xl p-4 sm:p-5 backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Cookie size={20} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            id="cookie-consent-title"
            className="text-sm font-bold text-emerald-900 inline-flex items-center gap-1.5"
          >
            <Cookie size={14} aria-hidden="true" /> {t("common.cookiesTitle", "Cookies on AgriSeva-AI")}
          </h2>
          <p
            id="cookie-consent-desc"
            className="mt-1 text-xs text-emerald-900/80 leading-relaxed"
          >
            {t("common.cookiesDesc", "We use a strictly-necessary cookie to keep you signed in. With your permission we will also enable Firebase Analytics to help us understand usage patterns. You can change your choice at any time from the ")}
            <Link to="/privacy" className="font-semibold underline underline-offset-2 hover:text-emerald-700">
              {t("common.privacyPolicy", "Privacy Policy")}
            </Link>
            .
          </p>

          {expanded && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-emerald-900/85">
              <li className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
                <p className="font-bold inline-flex items-center gap-1">
                  <ShieldCheck size={12} aria-hidden="true" /> {t("common.strictlyNecessary", "Strictly necessary")}
                </p>
                <p className="text-emerald-900/70 mt-0.5">
                  Firebase Auth session. Cannot be disabled.
                </p>
              </li>
              <li className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
                <p className="font-bold inline-flex items-center gap-1">
                  <BarChart3 size={12} aria-hidden="true" /> {t("common.analytics", "Analytics")}
                </p>
                <p className="text-emerald-900/70 mt-0.5">
                  Firebase Analytics (_ga, _gid). Used only with consent.
                </p>
              </li>
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50"
          aria-label={expanded ? t("common.hideDetails", "Hide cookie details") : t("common.showDetails", "Show cookie details")}
        >
          <Settings2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={reject}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-900 border border-emerald-200 hover:bg-emerald-50 transition-colors"
        >
          {t("common.rejectAnalytics", "Reject analytics")}
        </button>
        <button
          type="button"
          onClick={accept}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow"
        >
          {t("common.acceptAnalytics", "Accept analytics")}
        </button>
      </div>
    </div>
  );
}

export default CookieConsent;