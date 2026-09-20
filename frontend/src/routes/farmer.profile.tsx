import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/farmerDashboard/components/ProfilePage";

export const Route = createFileRoute("/farmer/profile")({
  component: ProfilePage,
});
