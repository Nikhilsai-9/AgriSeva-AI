/**
 * MainDashboardSidebar - the persistent left sidebar / tablet drawer that
 * exposes the global authenticated navigation.
 *
 * Responsive behavior (reuses the existing NAV_ITEMS from MainDashboardNav):
 *
 *   - lg+ (>=1024px desktop / laptop): sticky persistent left sidebar.
 *   - md (768-1023px tablet): drawer activated by the hamburger button
 *     in MainDashboardHeader.
 *   - <md (mobile): hidden - the header's horizontal scroll nav covers mobile.
 *
 * The Farmer Dashboard's internal sub-navigation lives in FarmerLayout and is
 * NOT replaced. On lg+ the Farmer sidebar sits next to this one.
 */

import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { X, LogOut } from "lucide-react";
import { useTranslation } from "@/locales";
import { useAuthStore } from "@/stores/auth-store";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { filterNavItemsForUser } from "./MainDashboardNav";
import { cn } from "@/lib/utils";

interface MainDashboardSidebarProps {
  /** Whether the tablet drawer is open. */
  open: boolean;
  /** Called when the user dismisses the tablet drawer. */
  onClose: () => void;
}

export function MainDashboardSidebar({ open, onClose }: MainDashboardSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { logout } = useAuthStore();
  const { data: currentUser } = useGetCurrentUser({});

  const userRoleObj = {
    role: (currentUser as { role?: string } | undefined)?.role ?? null,
  };
  const visibleItems = filterNavItemsForUser(userRoleObj);

  // Close the tablet drawer on every route change.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleSignOut = async () => {
    onClose();
    await logout();
    navigate({ to: "/auth" });
  };

  return (
    <>
      {/* Backdrop (tablet drawer mode only). */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:block lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      <aside
        aria-label={t("dashboard.globalNav", "Global navigation")}
        className={cn(
          // Persistent left sidebar on lg+
          "lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
          "lg:w-60 xl:w-64 2xl:w-72",
          "lg:flex lg:flex-col lg:shrink-0",
          "lg:border-r lg:border-emerald-100 lg:bg-white/80 lg:backdrop-blur-sm",
          "lg:overflow-y-auto",
          // Drawer mode on md
          "fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-2xl",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Show on md and above; mobile uses the header horizontal scroll nav
          "lg:flex md:flex hidden flex-col",
        )}
      >
        {/* Drawer close bar (tablet only) */}
        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-emerald-100 shrink-0">
          <span className="font-semibold text-emerald-900">
            {t("dashboard.globalNav", "Global navigation")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dashboard.closeMenu", "Close navigation menu")}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md text-emerald-800 hover:bg-emerald-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section header (visible on lg+) */}
        <div className="hidden lg:block px-4 pt-5 pb-2">
          <p className="text-[11px] uppercase tracking-wider text-emerald-700/70 font-semibold">
            {t("dashboard.globalNav", "Global navigation")}
          </p>
        </div>
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {visibleItems.map((item) => {
              const active = item.isActive(pathname);
              const Icon = item.icon;
              const isFarmer = item.fallback === "Farmer Dashboard";
              return (
                <Link
                  key={item.to + "s" + item.fallback}
                  to={item.to}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  data-tab-id={item.fallback.toLowerCase().replace(/\s+/g, "_")}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
                      "h-4 w-4 shrink-0",
                      isFarmer && (active ? "text-white" : "text-emerald-600"),
                    )}
                  />
                  <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        {/* Drawer footer with sign-out (so it's always reachable when sidebar is open). */}
        <div className="border-t border-emerald-100 p-3 shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-rose-700 hover:bg-rose-50"
            aria-label={t("farmer.header.signOut", "Sign out")}
          >
            <LogOut className="h-4 w-4" />
            <span>{t("farmer.header.signOut", "Sign out")}</span>
          </button>
        </div>
      </aside>
    </>
  );
}