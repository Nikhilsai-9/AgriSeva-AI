import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { BuyersListPage } from "@/features/farmerDashboard/components/BuyersListPage";

function FarmerBuyersRouteComponent() {
  const matches = useMatches();
  const currentMatch = matches[matches.length - 1];
  const isExactBuyers =
    currentMatch?.routeId === "/farmer/buyers" ||
    currentMatch?.pathname === "/farmer/buyers";

  return isExactBuyers ? <BuyersListPage /> : <Outlet />;
}

export const Route = createFileRoute("/farmer/buyers")({
  component: FarmerBuyersRouteComponent,
});

