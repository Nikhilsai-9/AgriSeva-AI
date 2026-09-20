import { createFileRoute } from "@tanstack/react-router";
import { FarmerHomePage } from "@/features/farmerDashboard/components/FarmerHomePage";

export const Route = createFileRoute("/farmer/")({
  component: FarmerHomePage,
});
