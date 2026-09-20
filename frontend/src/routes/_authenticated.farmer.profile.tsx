import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/farmerDashboard/components/ProfilePage";

export const Route = createFileRoute("/_authenticated/farmer/profile")({
  component: ProfilePage,
});
