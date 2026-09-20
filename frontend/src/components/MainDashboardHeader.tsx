/**
 * MainDashboardHeader - the single global authenticated header used by
 * every route that lives under the `_authenticated` pathless layout.
 *
 * Provides:
 *   - hamburger toggle (tablet only â€” opens the drawer sidebar)
 *   - brand (AgriSeva)
 *   - global nav (URL-driven; active item highlighted by route match)
 *   - language switcher
 *   - notifications bell
 *   - profile menu / sign-out
 *
 * The NAV_ITEMS list is sourced from `./MainDashboardNav` so it stays in
 * lock-step with `MainDashboardSidebar`.
 */

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut, BellIcon, Menu } from "lucide-react";
import { useTranslation } from "@/locales";
import { useAuthStore } from "@/stores/auth-store";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { AgriSevaBrand } from "./AgriSevaBrand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggleCompact } from "./atoms/ThemeToggle";
import { NotificationModal } from "./NotificationModal";
import { UserProfileActions } from "./atoms/user-profile-actions";
import { filterNavItemsForUser } from "./MainDashboardNav";
import { cn } from "@/lib/utils";

interface MainDashboardHeaderProps {
  /** Optional callback to toggle the sidebar drawer (tablet only). */
  onMenuToggle?: () => void;
}

export function MainDashboardHeader({
  onMenuToggle,
}: MainDashboardHeaderProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuthStore();
  const { data: currentUser } = useGetCurrentUser({});

  const handleSignOut = async () => {
    await logout();
    navigate({ to: "/auth" });
  };

  // AuthUser (in the store) only carries uid/email/name/avatar.
  // Role + notifications come from the API-fetched current user.
  const currentUserAny = currentUser as
    | {
        role?: string;
        name?: string;
        email?: string;
        notifications?: number;
      }
    | undefined;

  const userRoleObj = {
    role: currentUserAny?.role ?? null,
  };

  const visibleItems = filterNavItemsForUser(userRoleObj);

  const userName =
    currentUserAny?.name || user?.name || user?.email || "User";
  const initials = (userName || "U").charAt(0).toUpperCase();
  const unreadNotifications = currentUserAny?.notifications ?? 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 h-14 sm:h-16">
        {/* Hamburger (tablet only — opens the drawer sidebar). On lg+ the
            sidebar is persistent so the button is hidden. On mobile the
            horizontal scroll nav already provides access. */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={t("dashboard.openMenu", "Open navigation menu")}
          className="hidden md:inline-flex lg:hidden items-center justify-center h-9 w-9 rounded-md text-emerald-800 hover:bg-emerald-50 transition-colors shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand */}
        <Link
          to="/home"
          className="flex items-center gap-2 min-w-0 shrink-0"
          aria-label={t("dashboard.brand", "AgriSeva")}
        >
          <AgriSevaBrand size="sm" showSlogan={false} />
        </Link>
        {/* Global nav (lg+ — paired with persistent left sidebar).
            On md- (mobile) we keep the existing compact horizontal scroll. */}
        <nav
          className="flex-1 min-w-0 hidden lg:flex items-center justify-center gap-1 overflow-x-auto no-scrollbar"
          aria-label={t("dashboard.globalNav", "Global navigation")}
        >
          {visibleItems.map((item) => {
            const active = item.isActive(pathname);
            const Icon = item.icon;
            const isFarmer = item.fallback === "Farmer Dashboard";
            return (
              <Link
                key={item.to + item.fallback}
                to={item.to}
                data-tab-id={item.fallback.toLowerCase().replace(/\s+/g, "_")}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all flex-shrink-0",
                  active
                    ? isFarmer
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-accent text-accent-foreground"
                    : isFarmer
                      ? "text-emerald-700 hover:bg-emerald-50"
                      : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isFarmer && (active ? "text-white" : "text-emerald-600"),
                  )}
                />
                <span className="whitespace-nowrap">
                  {t(item.labelKey, item.fallback)}
                </span>
              </Link>
            );
          })}
        </nav>
        {/* Mobile global nav (compact horizontal scroll) */}
        <nav
          className="flex-1 min-w-0 flex lg:hidden items-center gap-1 overflow-x-auto no-scrollbar"
          aria-label={t("dashboard.globalNav", "Global navigation")}
        >
          {visibleItems.map((item) => {
            const active = item.isActive(pathname);
            const Icon = item.icon;
            const isFarmer = item.fallback === "Farmer Dashboard";
            return (
              <Link
                key={item.to + "m" + item.fallback}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium flex-shrink-0",
                  active
                    ? isFarmer
                      ? "bg-emerald-600 text-white"
                      : "bg-accent text-accent-foreground"
                    : isFarmer
                      ? "text-emerald-700"
                      : "text-foreground/70 hover:bg-accent/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">
                  {t(item.labelKey, item.fallback)}
                </span>
              </Link>
            );
          })}
        </nav>
        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <LanguageSwitcher variant="outline" />

          <NotificationModal
            trigger={
              <button
                type="button"
                className="relative p-1 rounded-md hover:bg-accent transition-colors"
                aria-label={t("dashboard.notifications", "Notifications")}
              >
                <BellIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-[4px] -right-[12px] flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
            }
          />

          <ThemeToggleCompact />

          {/* Compact profile chip (visible md+) */}
          <div className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-semibold">
              {initials}
            </span>
            <span className="text-sm font-medium text-emerald-900 truncate max-w-[120px]">
              {userName}
            </span>
          </div>

          {/* Full profile dropdown */}
          <UserProfileActions />

          {/* Mobile-friendly explicit sign-out button (icon only) */}
          <button
            type="button"
            onClick={handleSignOut}
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-rose-700 hover:bg-rose-50"
            aria-label={t("farmer.header.signOut", "Sign out")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}