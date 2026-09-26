/**
 * FarmerDashboardShell — the /farmer/* route entry point.
 *
 * Composes the global AgriSeva-AI application chrome (logo + main
 * navigation + language switcher + notification bell + theme toggle +
 * profile menu + hamburger) with the farmer-specific surface
 * (<FarmerContent/> → sidebar + outlet + bottom-nav).
 *
 * Result: clicking "Farmer Dashboard" in the global header (or visiting
 * /farmer/* directly) renders Farmer content INSIDE the same global
 * shell — there is exactly ONE application-level header visible to the
 * user, no duplicate sign-out, no duplicate language selector, no
 * duplicate notification bell, no duplicate profile chip, no duplicate
 * hamburger.
 *
 * This is the new canonical mounting point for the Farmer Dashboard:
 *
 *     <PlaygroundHeader/>                ← shared with /home (identical)
 *       └── <FarmerContent/>              ← farmer-specific only
 *             ├── <SideNav/>              ← Home / Prices / Buyers / ...
 *             ├── <Outlet />              ← /farmer/$child route content
 *             └── <BottomNav/>            ← mobile only
 *
 * Authentication is unchanged: this shell reads the same `useAuthStore`
 * that the rest of the app reads. The logout/profile menu is rendered
 * by the global <PlaygroundHeader/> (which uses <UserProfileActions/>)
 * — there is no second logout implementation.
 *
 * Backed by:
 *   - /routes/farmer.tsx             (this file mounts the shell)
 *   - /routes/farmer.*.tsx          (child routes, render via <Outlet/>)
 *   - features/farmerDashboard/FarmerLayout.tsx (FarmerContent + chrome)
 */

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PlaygroundHeader } from "@/components/PlaygroundHeader";
import { Tabs } from "@/components/atoms/tabs";
import { FarmerContent } from "@/features/farmerDashboard/FarmerLayout";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { PageMeta } from "@/components/PageMeta";

/**
 * The active-tab value that <PlaygroundHeader/> uses for the Farmer
 * Dashboard entry. Exported so other modules (e.g. the global mobile
 * sidebar or a future deep-link modal) can keep their identifier in
 * sync.
 */
export const FARMER_DASHBOARD_TAB = "farmer_dashboard";

export function FarmerDashboardShell() {
  const navigate = useNavigate();
  const { data: user } = useGetCurrentUser({});

  // Local chatbot-source state — the farmer surface does not consume
  // it, but <PlaygroundHeader/> requires both a setter and a value.
  // We intentionally pin it to "annam" (the same default PlaygroundPage
  // uses) so the header is a no-op for source switching on this route.
  // The setter is unused on this route (the user cannot toggle source
  // from the Farmer shell) but the prop is required by the header.
  const [, setChatbotSource] = useState<
    "annam" | "whatsapp" | "acc"
  >("annam");

  /**
   * Tab-change handler — translates a global-header tab click into a
   * route navigation.
   *
   *   • "farmer_dashboard"              → no-op (we ARE the farmer view)
   *   • "performance"/"roleDashboard"/  → navigate to /home and let
   *     "expertPerformance"/role-based     PlaygroundPage pick the right
   *     view                                dashboard for the role
   *   • "all_questions"/"questions"/    → /home (PlaygroundPage decides
   *     "request_queue"/"history"/...      the active tab from state)
   *   • "upload"/"call_interface"/      → /home (non-farmer tabs visible
   *     "call_history"/"manage_agents"/   only to specific roles; we
   *     "data_processing"/                 keep the simple, predictable
   *     "chatbotanalytics"                 redirect)
   *
   * This guarantees the user always lands back inside the global shell,
   * regardless of which tab they clicked.
   */
  const handleTabChange = (value: string) => {
    if (value === FARMER_DASHBOARD_TAB) return; // already here
    navigate({ to: "/home" });
    // We deliberately do NOT set any local activeTab — PlaygroundPage
    // owns the active-tab state on /home. Browser history + a fresh
    // render inside PlaygroundPage re-derives the active tab from
    // localStorage / explicit selection just like any other navigation
    // to /home does.
  };

  // setTab is required by <PlaygroundHeader/> (the MobileSidebar uses it
  // when the user picks a non-Farmer tab from the hamburger menu). We route
  // it through handleTabChange so any non-Farmer tab from the mobile sidebar
  // behaves identically to clicking that tab in the desktop nav: navigate
  // to /home and let PlaygroundPage pick up the right active tab from there.
  //
  // Both setTab and onTabChange funnel through handleTabChange; the parent
  // <Tabs> below wires its own onValueChange to the same handler so the
  // desktop TabsTrigger clicks behave identically.

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50 via-white to-amber-50 text-foreground flex flex-col">
      <PageMeta
        title="Farmer Dashboard"
        description="AgriSeva-AI Farmer Dashboard — live Agmarknet mandi prices, lots, storage, logistics, payments, and buyer offers."
      />
      {/*
        <PlaygroundHeader/> contains <TabsList> and <TabsTrigger> (Radix UI
        primitives), which require a <Tabs> ancestor in the React context
        tree — without it the page crashes with "TabsList must be used
        within Tabs". The other two consumers (play-ground.tsx and
        routes/chatbot/index.tsx) wrap the header in <Tabs> for the same
        reason; we mirror that contract here.
      */}
      <Tabs
        value={FARMER_DASHBOARD_TAB}
        onValueChange={handleTabChange}
        className="h-full w-full"
      >
        <PlaygroundHeader
          user={user ?? null}
          activeTab={FARMER_DASHBOARD_TAB}
          onTabChange={handleTabChange}
          setTab={handleTabChange}
          setChatbotSource={setChatbotSource}
        />
        <FarmerContent />
      </Tabs>
    </div>
  );
}
