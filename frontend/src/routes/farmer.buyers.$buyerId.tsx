import { createFileRoute } from "@tanstack/react-router";
import { BuyerDetailPage } from "@/features/farmerDashboard/components/BuyerDetailPage";

export const Route = createFileRoute("/farmer/buyers/$buyerId")({
  component: BuyerDetailRoute,
});

function BuyerDetailRoute() {
  const { buyerId } = Route.useParams();
  return <BuyerDetailPage buyerId={buyerId} />;
}
