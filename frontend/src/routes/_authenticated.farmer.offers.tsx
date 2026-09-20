import { createFileRoute } from "@tanstack/react-router";
import { OffersPage } from "@/features/farmerDashboard/components/OffersPage";

export const Route = createFileRoute("/_authenticated/farmer/offers")({
  component: OffersPage,
});
