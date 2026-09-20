import { createFileRoute } from "@tanstack/react-router";
import { BuyersListPage } from "@/features/farmerDashboard/components/BuyersListPage";

export const Route = createFileRoute("/_authenticated/farmer/buyers")({
  component: BuyersListPage,
});
