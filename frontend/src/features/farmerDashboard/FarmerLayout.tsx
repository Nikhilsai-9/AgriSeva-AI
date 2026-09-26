/**
 * FarmerLayout — Farmer Dashboard surface, decomposed into:
 *
 *   - <FarmerContent/> : the farmer-specific chrome (left sidebar + bottom
 *     nav + outlet). NO application-level header. Designed to render INSIDE
 *     the existing global AgriSeva-AI application shell so that there is
 *     exactly ONE top-of-page header / language selector / notification bell
 *     / profile / sign-out / hamburger across the whole app.
 *
 *   - <FarmerLayout/>  : legacy standalone shell kept exported for
 *     backwards-compat (no production route currently mounts it). New
 *     consumers should use <FarmerDashboardShell/> from
 *     `@/features/farmerDashboard/FarmerDashboardShell` which composes
 *     FarmerContent with the existing global <PlaygroundHeader/>.
 *
 * Architecture contract:
 *
 *     GlobalAppShell    (mounted at /home via PlaygroundPage)
 *       ├── Dashboard
 *       ├── Farmer Dashboard        ─── clicks navigate to /farmer/* ───┐
 *       ├── All Questions                                                  │
 *       └── Agents Interface                                               ▼
 *                                                                GlobalAppShell' (same shell, mounted at /farmer)
 *                                                                  ├── FarmerContent
 *                                                                  │     ├── left SideNav (Home/Prices/Buyers/...)
 *                                                                  │     └── <Outlet />  (sub-route content)
 *                                                                  └── BottomNav (mobile)
 *
 * i.e. /farmer is just ANOTHER page inside the same global shell, not a
 * separate application.
 */

import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Home,
  TrendingUp,
  Factory,
  Sprout,
  Handshake,
  Truck,
  Warehouse,
  Wallet,
  MessageCircleWarning,
  User,
  Scale,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/farmer", labelKey: "farmer.nav.home", icon: Home, end: true },
  { to: "/farmer/prices", labelKey: "farmer.nav.prices", icon: TrendingUp },
  { to: "/farmer/buyers", labelKey: "farmer.nav.buyers", icon: Factory },
  { to: "/farmer/lots", labelKey: "farmer.nav.lots", icon: Sprout },
  { to: "/farmer/offers", labelKey: "farmer.nav.offers", icon: Handshake },
];

const SECONDARY_NAV: NavItem[] = [
  { to: "/farmer/recommend", labelKey: "farmer.nav.recommend", icon: Scale },
  { to: "/farmer/logistics", labelKey: "farmer.nav.logistics", icon: Truck },
  { to: "/farmer/storage", labelKey: "farmer.nav.storage", icon: Warehouse },
  { to: "/farmer/payments", labelKey: "farmer.nav.payments", icon: Wallet },
  { to: "/farmer/grievances", labelKey: "farmer.nav.grievances", icon: MessageCircleWarning },
  { to: "/farmer/profile", labelKey: "farmer.nav.profile", icon: User },
];

const BOTTOM_NAV: NavItem[] = [
  { to: "/farmer", labelKey: "farmer.nav.home", icon: Home, end: true },
  { to: "/farmer/prices", labelKey: "farmer.nav.prices", icon: TrendingUp },
  { to: "/farmer/buyers", labelKey: "farmer.nav.buyers", icon: Factory },
  { to: "/farmer/lots", labelKey: "farmer.nav.lots", icon: Sprout },
  { to: "/farmer/offers", labelKey: "farmer.nav.offers", icon: Handshake },
];

/**
 * FarmerContent — the farmer-specific chrome (sidebar + outlet + bottom
 * nav). It is rendered INSIDE the global AgriSeva-AI application shell,
 * not as a standalone application. It deliberately does NOT include any
 * application-level controls (logo/header, language switcher,
 * notifications bell, theme toggle, profile chip, sign-out button or
 * hamburger). Those live in <PlaygroundHeader/> which sits above this
 * component in the route tree.
 *
 * Used by:
 *   - <FarmerDashboardShell/> (`features/farmerDashboard/FarmerDashboardShell.tsx`)
 *     which composes FarmerContent with <PlaygroundHeader/> for the
 *     /farmer/* route.
 *   - <FarmerLayout/> below (legacy standalone shell, not used by any
 *     production route).
 */
export function FarmerContent() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <>
      {/*
        Demo-mode banner lives here (not in the application header) so the
        truthful per-feature source badges remain the source of truth for
        data provenance on production builds (VITE_ENABLE_MOCKS=false).
        When MSW is intercepting every API call (VITE_ENABLE_MOCKS=true)
        the whole stack is mock and the global "Demo Mode" banner is
        honest.
      */}
      {env.enableMocks() && <DemoBanner t={t} />}
      <div className="flex w-full">
        <SideNav
          t={t}
          pathname={location.pathname}
          primary={PRIMARY_NAV}
          secondary={SECONDARY_NAV}
        />
        <main className="flex-1 min-w-0 pb-28 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav t={t} pathname={location.pathname} items={BOTTOM_NAV} />
    </>
  );
}

/**
 * FarmerLayout — LEGACY standalone shell.
 *
 * Wraps <FarmerContent/> with its own application header. Kept exported
 * for backwards-compat (no production route currently mounts it). Use
 * <FarmerDashboardShell/> (which composes <FarmerContent/> with the
 * shared <PlaygroundHeader/>) instead.
 *
 * The legacy shell duplicates the application-level chrome (its own
 * logo, language switcher, notification bell, profile chip, sign-out
 * and back button) and therefore is no longer wired into the route tree.
 */
export function FarmerLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="farmer-shell min-h-screen w-full bg-gradient-to-b from-emerald-50 via-white to-amber-50 text-foreground">
      <div className="flex w-full">
        <SideNav
          t={t}
          pathname={location.pathname}
          primary={PRIMARY_NAV}
          secondary={SECONDARY_NAV}
        />
        <main className="flex-1 min-w-0 pb-28 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav t={t} pathname={location.pathname} items={BOTTOM_NAV} />
    </div>
  );
}

function DemoBanner({ t }: { t: (k: string, fb: string) => string }) {
  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 text-amber-900 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-300 text-amber-900 text-[10px] font-bold">!</span>
        <p>
          {t(
            "farmer.banner.demo",
            "Demo Mode - The frontend is running against MSW mocks (VITE_ENABLE_MOCKS=true). Backend APIs are intercepted for offline development, so live mandi feeds and real buyer KYC verification are not active. Per-section source badges still label each dataset."
          )}
        </p>
      </div>
    </div>
  );
}

function SideNav({
  t,
  pathname,
  primary,
  secondary,
}: {
  t: (k: string, fb: string) => string;
  pathname: string;
  primary: NavItem[];
  secondary: NavItem[];
}) {
  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 shrink-0 border-r border-emerald-100 bg-white/70 backdrop-blur-sm h-[calc(100vh-7rem)] sticky top-16 overflow-y-auto py-4">
      <NavGroup
        title={t("farmer.nav.marketGroup", "Market")}
        items={primary}
        pathname={pathname}
        t={t}
      />
      <NavGroup
        title={t("farmer.nav.supportGroup", "Operations")}
        items={secondary}
        pathname={pathname}
        t={t}
      />
    </aside>
  );
}

function NavGroup({
  title,
  items,
  pathname,
  t,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  t: (k: string, fb: string) => string;
}) {
  return (
    <div className="px-3 mb-4">
      <p className="px-3 text-[11px] uppercase tracking-wider text-emerald-700/70 font-semibold mb-2">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            item={item}
            active={isActive(pathname, item)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  t,
}: {
  item: NavItem;
  active: boolean;
  t: (k: string, fb: string) => string;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-emerald-600 text-white shadow"
          : "text-emerald-900 hover:bg-emerald-50"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{t(item.labelKey, fallbackFor(item))}</span>
    </Link>
  );
}

function BottomNav({
  t,
  pathname,
  items,
}: {
  t: (k: string, fb: string) => string;
  pathname: string;
  items: NavItem[];
}) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-emerald-100 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center py-2 text-[10px] sm:text-[11px] font-medium min-h-[56px]",
                active ? "text-emerald-700" : "text-emerald-900/70"
              )}
            >
              <Icon
                className={cn("h-5 w-5 sm:h-6 sm:w-6 mb-0.5", active && "scale-110")}
              />
              <span className="truncate px-1">
                {t(item.labelKey, fallbackFor(item))}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 bg-emerald-600 rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function isActive(pathname: string, item: NavItem) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

function fallbackFor(item: NavItem): string {
  switch (item.to) {
    case "/farmer":
      return "Home";
    case "/farmer/prices":
      return "Prices";
    case "/farmer/buyers":
      return "Buyers";
    case "/farmer/lots":
      return "My Lots";
    case "/farmer/offers":
      return "Offers";
    case "/farmer/logistics":
      return "Logistics";
    case "/farmer/storage":
      return "Storage";
    case "/farmer/payments":
      return "Payments";
    case "/farmer/grievances":
      return "Grievances";
    case "/farmer/profile":
      return "Profile";
    case "/farmer/recommend":
      return "Compare";
    default:
      return "Menu";
  }
}

// Re-export a small Card wrapper so the page components can be terse
// without pulling in the heavy atoms/card in every file.
export function FarmerCard({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-emerald-100/80 shadow-sm shadow-emerald-900/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function FarmerSectionTitle({
  children,
  hint,
  action,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 mb-3", className)}>
      <div>
        <h2 className="text-base sm:text-lg font-bold text-emerald-900">
          {children}
        </h2>
        {hint && (
          <p className="text-xs sm:text-sm text-emerald-900/60 mt-0.5">
            {hint}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function FarmerPageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6",
        className
      )}
    >
      {children}
    </div>
  );
}





// ── NotificationsDropdown was REMOVED ──
// The duplicate in-shell notification button is gone; the global
// notification bell in <PlaygroundHeader/> is the single notification
// UI for the whole app. See git history for the removed component.
