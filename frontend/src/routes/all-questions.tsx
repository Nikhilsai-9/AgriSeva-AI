import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/all-questions")({
  beforeLoad: () => {
    throw redirect({
      to: "/home",
      search: { tab: "all_questions" },
    });
  },
  component: () => null,
});
