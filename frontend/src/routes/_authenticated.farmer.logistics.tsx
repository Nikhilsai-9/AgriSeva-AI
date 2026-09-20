import { createFileRoute } from "@tanstack/react-router";
import { LogisticsPage } from "@/features/farmerDashboard/components/LogisticsPage";

export const Route = createFileRoute("/_authenticated/farmer/logistics")({
  component: LogisticsPage,
});
