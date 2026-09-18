import { createFileRoute } from "@tanstack/react-router";
import { MyLotsPage } from "@/features/farmerDashboard/components/MyLotsPage";

export const Route = createFileRoute("/farmer/lots")({
  component: MyLotsPage,
});
