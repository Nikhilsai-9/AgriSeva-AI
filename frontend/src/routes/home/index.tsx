import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlaygroundPage } from "@/components/play-ground";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";
import { z } from "zod";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { isCoordinatorRole } from "@/lib/roles";
export const Route = createFileRoute("/home/")({
  validateSearch: z.object({
    question: z.string().optional(),
    request: z.string().optional(),
    comment: z.string().optional(),
    history:z.string().optional(),
    expertId:z.string().optional(),
    questionType:z.string().optional()
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: currentUser, isLoading } = useGetCurrentUser({});

  useEffect(() => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (currentUser?.role === "pae_expert") {
      navigate({ to: "/pae-expert" });
      return;
    }
    if (isCoordinatorRole(currentUser?.role)) {
      navigate({
        to: "/user/$userId",
        params: { userId: currentUser?._id || user.uid },
      });
      return;
    }
  }, [user, currentUser, navigate]);

  // While loading user auth state or redirecting
  if (!user || isLoading || currentUser?.role === "pae_expert" || isCoordinatorRole(currentUser?.role)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading AgriSeva-AI...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-screen p-4 relative flex flex-col overflow-hidden">
      <PlaygroundPage />
    </div>
  );
}
