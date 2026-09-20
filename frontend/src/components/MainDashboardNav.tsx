/**
 * MainDashboardNav — the SINGLE source of truth for the global authenticated
 * navigation list. Both MainDashboardHeader (top horizontal bar) and
 * MainDashboardSidebar (left vertical sidebar / drawer) consume NAV_ITEMS from
 * here so the user sees the same destinations regardless of viewport.
 *
 * Adding/removing/reordering an entry here automatically updates:
 *   - the desktop/tablet horizontal nav in the header
 *   - the mobile horizontal scroll nav in the header
 *   - the desktop persistent left sidebar
 *   - the tablet drawer sidebar (activated by hamburger button)
 */

import {
  LayoutDashboard,
  Sprout,
  BarChart3,
  MessageCircle,
  Phone,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { canManageUsers, isCoordinatorRole } from "@/lib/roles";

export interface GlobalNavItem {
  to: string;
  labelKey: string;
  fallback: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
  visibleFor?: (
    user: { role?: string | null } | null | undefined,
  ) => boolean;
}

export const NAV_ITEMS: GlobalNavItem[] = [
  {
    to: "/home",
    labelKey: "dashboard.tabsDashboard",
    fallback: "Dashboard",
    icon: LayoutDashboard,
    isActive: (p) => p === "/home",
    visibleFor: (u) =>
      !!u &&
      !isCoordinatorRole(u.role ?? null) &&
      u.role !== "expert" &&
      u.role !== "call_agent" &&
      u.role !== "gate_keeper" &&
      u.role !== "auditor",
  },
  {
    to: "/farmer",
    labelKey: "dashboard.tabsFarmerDashboard",
    fallback: "Farmer Dashboard",
    icon: Sprout,
    isActive: (p) => p === "/farmer" || p.startsWith("/farmer/"),
    visibleFor: (u) => u?.role === "farmer",
  },
  {
    to: "/home",
    labelKey: "dashboard.tabsAll",
    fallback: "All Questions",
    icon: MessageCircle,
    isActive: (p) => p === "/home",
    visibleFor: (u) => !!u && u.role !== "call_agent",
  },
  {
    to: "/whatsapp-history",
    labelKey: "dashboard.tabsChatbotHistory",
    fallback: "ChatBot History",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/whatsapp-history"),
    visibleFor: (u) => !!u && u.role !== "call_agent",
  },
  {
    to: "/chatbot",
    labelKey: "dashboard.tabsAnalytics",
    fallback: "ChatBot Analytics",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/chatbot"),
    visibleFor: (u) => !!u && (u.role === "admin" || u.role === "moderator"),
  },
  {
    to: "/home",
    labelKey: "dashboard.tabsAgents",
    fallback: "Agents Interface",
    icon: Users,
    isActive: (p) => p === "/home",
    visibleFor: (u) => !!u && u.role !== "call_agent",
  },
  {
    to: "/home",
    labelKey: "dashboard.tabsCallInterface",
    fallback: "Call Interface",
    icon: Phone,
    isActive: (p) => p === "/home",
    visibleFor: (u) => u?.role === "call_agent",
  },
  {
    to: "/home",
    labelKey: "dashboard.tabsManageAgents",
    fallback: "Manage Agents",
    icon: Settings,
    isActive: (p) => p === "/home",
    visibleFor: (u) =>
      !!u && canManageUsers((u.role ?? "") as never),
  },
];

/**
 * Filters NAV_ITEMS for the given user. Items without a visibleFor() predicate
 * are visible to everyone.
 */
export function filterNavItemsForUser(
  user: { role?: string | null } | null | undefined,
): GlobalNavItem[] {
  return NAV_ITEMS.filter((it) => (it.visibleFor ? it.visibleFor(user) : true));
}
