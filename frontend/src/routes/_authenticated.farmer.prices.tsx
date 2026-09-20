import { createFileRoute } from "@tanstack/react-router";
import { MarketPricesPage } from "@/features/farmerDashboard/components/MarketPricesPage";

export const Route = createFileRoute("/_authenticated/farmer/prices")({
  component: MarketPricesPage,
});
