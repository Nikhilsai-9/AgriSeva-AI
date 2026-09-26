/**
 * /farmer — Parent route. Renders <FarmerDashboardShell/> which composes
 * the existing global AgriSeva-AI application header
 * (<PlaygroundHeader/>) with the farmer-specific surface
 * (<FarmerContent/> → sidebar + outlet + bottom-nav).
 *
 * Architectural contract: /farmer is NOT a separate application. It is
 * a child page of the existing global application shell. The shell
 * mounted here is the SAME PlaygroundHeader component that /home mounts
 * (identical logo, navigation, language selector, notification bell,
 * theme toggle, profile menu, hamburger) — there is no second copy of
 * any application-level control.
 *
 * Child routes (/farmer/index, /farmer/prices, /farmer/buyers, ...,
 * /farmer/lots/$lotId, /farmer/buyers/$buyerId, /farmer/lots/new) all
 * render through <FarmerContent/>'s <Outlet/> so the global header
 * remains mounted throughout.
 *
 * Implemented and owned entirely by the new farmer dashboard. It does
 * NOT touch the existing /home dashboard, /coordinator, /pae-expert or
 * any other route.
 */

import { createFileRoute } from "@tanstack/react-router";
import { FarmerDashboardShell } from "@/features/farmerDashboard/FarmerDashboardShell";

export const Route = createFileRoute("/farmer")({
  component: FarmerDashboardShell,
});
