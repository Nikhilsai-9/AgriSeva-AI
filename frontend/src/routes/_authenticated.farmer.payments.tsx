import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/features/farmerDashboard/components/PaymentsPage";

export const Route = createFileRoute("/_authenticated/farmer/payments")({
  component: PaymentsPage,
});
