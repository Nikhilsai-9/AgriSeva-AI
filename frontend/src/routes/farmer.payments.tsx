import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/features/farmerDashboard/components/PaymentsPage";

export const Route = createFileRoute("/farmer/payments")({
  component: PaymentsPage,
});
