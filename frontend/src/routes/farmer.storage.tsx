import { createFileRoute } from "@tanstack/react-router";
import { StoragePage } from "@/features/farmerDashboard/components/StoragePage";

export const Route = createFileRoute("/farmer/storage")({
  component: StoragePage,
});
