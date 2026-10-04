import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { MyLotsPage } from "@/features/farmerDashboard/components/MyLotsPage";

function FarmerLotsRouteComponent() {
  const matches = useMatches();
  const currentMatch = matches[matches.length - 1];
  const isExactLots =
    currentMatch?.routeId === "/farmer/lots" ||
    currentMatch?.pathname === "/farmer/lots";

  return isExactLots ? <MyLotsPage /> : <Outlet />;
}

export const Route = createFileRoute("/farmer/lots")({
  component: FarmerLotsRouteComponent,
});

