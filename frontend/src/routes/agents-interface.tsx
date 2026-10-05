import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agents-interface")({
  beforeLoad: () => {
    throw redirect({
      to: "/home",
      search: { tab: "upload" },
    });
  },
  component: () => null,
});
