/**
 * FarmerLayout ΓÇö the shell for the new Farmer Market Intelligence
 * Dashboard.
 *
 * This is the FIRST component the user sees when they navigate to
 * /farmer/*. It provides:
 *   - top header with greeting + language switcher + sign-out
 *   - left side navigation (desktop / tablet)
 *   - bottom navigation (mobile, large touch targets)
 *   - demo-data banner (visible whenever any data on the page is demo)
 *
 * The shell is fully isolated from the existing /home dashboard.
 * It reuses ONLY the existing useTranslation() + useAuthStore() + the
 * LanguageSwitcher, which are intentionally framework-level.
 */

import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  Bell,
  LogOut,
  ChevronLeft,
  Scale,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkAllNotificationsRead,
} from "@/features/farmerDashboard/hooks/data";
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

export function FarmerLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthStore();

  const handleSignOut = async () => {
    await auth.logout();
    navigate({ to: "/auth" });
  };

  return (
    <div className="farmer-shell min-h-screen w-full bg-gradient-to-b from-emerald-50 via-white to-amber-50 text-foreground">
      <DemoBanner t={t} />
      <Header
        t={t}
        userName={auth.user?.name || "Farmer"}
        onSignOut={handleSignOut}
      />
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
            "Demo Data ΓÇö This dashboard currently renders sample data so you can explore the experience. Live mandi feeds and buyer KYC will be enabled when the production backend is connected."
          )}
        </p>
      </div>
    </div>
  );
}

function Header({
  t,
  userName,
  onSignOut,
}: {
  t: (k: string, fb: string) => string;
  userName: string;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-emerald-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-emerald-50 text-emerald-700"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Link to="/farmer" className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow">
              <Sprout className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold truncate">
                {t("farmer.brand.kicker", "AgriSeva ΓÇó Farmer")}
              </span>
              <span className="text-base sm:text-lg font-bold text-emerald-900 truncate">
                {t("farmer.brand.title", "Market Intelligence")}
              </span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher variant="light" />
          <NotificationsDropdown t={t} />
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-semibold">
              {(userName || "F").charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-emerald-900 truncate max-w-[120px]">
              {userName}
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1 px-2 sm:px-3 h-9 rounded-md text-sm text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("farmer.header.signOut", "Sign out")}
            </span>
          </button>
        </div>
      </div>
    </header>
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





function NotificationsDropdown({
  t,
}: {
  t: (k: string, fb: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { data: items } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  const list = items ?? [];
  const unread = list.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 rounded-md items-center justify-center hover:bg-emerald-50 text-emerald-700"
        aria-label={t("farmer.header.notifications", "Notifications")}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-emerald-100 z-40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100">
            <p className="text-sm font-bold text-emerald-900">
              {t("farmer.header.notificationsTitle", "Notifications")}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                {t("farmer.header.markAllRead", "Mark all read")}
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <div className="p-6 text-center text-sm text-emerald-900/60">
              {t("farmer.header.emptyNotifications", "No new notifications.")}
            </div>
          ) : (
            <ul className="divide-y divide-emerald-50">
              {list.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-emerald-50/60"
                  >
                    <p className="text-xs font-bold text-emerald-900">{n.title}</p>
                    <p className="text-xs text-emerald-900/70 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-emerald-900/40 mt-0.5">
                      {new Date(n.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
