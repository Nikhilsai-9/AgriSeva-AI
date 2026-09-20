import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/features/legal/TermsPage";

export const Route = createFileRoute("/terms/")({
  component: TermsPage,
});