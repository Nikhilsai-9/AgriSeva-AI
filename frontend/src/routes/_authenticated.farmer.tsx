/**
 * /farmer — Parent route. Renders the FarmerLayout shell which in turn
 * renders the matching child route via <Outlet />.
 *
 * Implemented and owned entirely by the new farmer dashboard. It does
 * NOT touch the existing /home dashboard, /coordinator, /pae-expert or
 * any other route.
 */

import { createFileRoute } from "@tanstack/react-router";
import { FarmerLayout } from "@/features/farmerDashboard/FarmerLayout";

export const Route = createFileRoute("/_authenticated/farmer")({
  component: FarmerLayout,
});
