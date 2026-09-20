import { createFileRoute } from "@tanstack/react-router";
import { MarketComparisonPage } from "@/features/farmerDashboard/components/MarketComparisonPage";

export const Route = createFileRoute("/farmer/recommend")({
  component: MarketComparisonPage,
});
