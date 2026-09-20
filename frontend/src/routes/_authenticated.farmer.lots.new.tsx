import { createFileRoute } from "@tanstack/react-router";
import { CreateLotPage } from "@/features/farmerDashboard/components/CreateLotPage";

export const Route = createFileRoute("/_authenticated/farmer/lots/new")({
  component: CreateLotPage,
});
