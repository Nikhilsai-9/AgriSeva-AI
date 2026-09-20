/**
 * MainDashboardShell — the SINGLE global authenticated shell that
 * wraps every authenticated route in the app.
 *
 * Provides, ONCE:
 *   - the global header (brand, language switcher, notifications bell,
 *     profile menu / sign-out) via MainDashboardHeader
 *   - a responsive main navigation:
 *       - persistent left sidebar on lg+ (desktop / laptop)
 *       - drawer activated by the header's hamburger button on md (tablet)
 *       - hidden on mobile (<md) where the header's horizontal scroll nav
 *         covers navigation
 *
 * The user clicks any nav item, the route changes, and the page content
 * is rendered via <Outlet /> to the right of the sidebar.
 *
 * On /farmer/*, FarmerLayout renders inside the Outlet and adds its OWN
 * sub-navigation to the right of the global sidebar. Both sidebars coexist
 * on lg+; on tablet/mobile FarmerLayout falls back to its bottom navigation.
 */

import { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { MainDashboardHeader } from "./MainDashboardHeader";
import { MainDashboardSidebar } from "./MainDashboardSidebar";

export function MainDashboardShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="main-dashboard-shell min-h-screen w-full bg-background text-foreground flex flex-col">
      <MainDashboardHeader onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <div className="flex flex-1 min-w-0">
        <MainDashboardSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 min-w-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
