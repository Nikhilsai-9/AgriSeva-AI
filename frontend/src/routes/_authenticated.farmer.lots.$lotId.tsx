import { createFileRoute } from "@tanstack/react-router";
import { LotDetailPage } from "@/features/farmerDashboard/components/LotDetailPage";

export const Route = createFileRoute("/_authenticated/farmer/lots/$lotId")({
  component: LotDetailRoute,
});

function LotDetailRoute() {
  const { lotId } = Route.useParams();
  return <LotDetailPage lotId={lotId} />;
}
