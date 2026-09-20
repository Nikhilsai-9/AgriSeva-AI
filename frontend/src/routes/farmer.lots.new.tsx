import { createFileRoute } from "@tanstack/react-router";
import { CreateLotPage } from "@/features/farmerDashboard/components/CreateLotPage";

export const Route = createFileRoute("/farmer/lots/new")({
  component: CreateLotPage,
});
