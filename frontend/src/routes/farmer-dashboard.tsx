import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/farmer-dashboard")({
  beforeLoad: () => {
    throw redirect({
      to: "/farmer",
    });
  },
  component: () => null,
});
