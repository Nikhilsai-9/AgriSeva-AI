import { createFileRoute } from "@tanstack/react-router";
import { GrievancesPage } from "@/features/farmerDashboard/components/GrievancesPage";

/**
 * Search schema for the Grievances page.
 *
 * Used by the Payments → "Raise dispute" deep link to prefill the
 * grievance form with the related payment reference (market intelligence
 * cross-screen wiring).
 */
export const Route = createFileRoute("/farmer/grievances")({
  component: GrievancesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    prefill:
      typeof search.prefill === "string" ? search.prefill : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
});
