import { createFileRoute } from "@tanstack/react-router";
import { GrievancesPage } from "@/features/farmerDashboard/components/GrievancesPage";

export const Route = createFileRoute("/farmer/grievances")({
  component: GrievancesPage,
});
