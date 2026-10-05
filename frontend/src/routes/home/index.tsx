import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlaygroundPage } from "@/components/play-ground";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";
import { z } from "zod";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { isCoordinatorRole, isFarmerOrUserRole } from "@/lib/roles";
import { useTranslation } from "@/locales";
import { PageMeta } from "@/components/PageMeta";
export const Route = createFileRoute("/home/")({
  validateSearch: z.object({
    tab: z.string().optional(),
    question: z.string().optional(),
    request: z.string().optional(),
    comment: z.string().optional(),
    history: z.string().optional(),
    expertId: z.string().optional(),
    questionType: z.string().optional(),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: currentUser, isLoading } = useGetCurrentUser({});

  useEffect(() => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (isLoading) return;

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

    // Normal users/farmers belong on their dedicated User/Farmer Dashboard (/farmer).
    // Only permit access to /home if they explicitly requested a separate feature tab like all_questions or upload.
    if (isFarmerOrUserRole(currentUser?.role)) {
      if (!search.tab || search.tab === "dashboard" || search.tab === "performance") {
        navigate({ to: "/farmer" });
        return;
      }
    }
  }, [user, currentUser, isLoading, navigate, search.tab]);

  // While loading user auth state or redirecting
  if (
    !user ||
    isLoading ||
    currentUser?.role === "pae_expert" ||
    isCoordinatorRole(currentUser?.role) ||
    (isFarmerOrUserRole(currentUser?.role) && (!search.tab || search.tab === "dashboard" || search.tab === "performance"))
  ) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">{t("common.loadingApp", "Loading AgriSeva-AI...")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-2 sm:px-4 py-2 sm:py-4 relative flex flex-col">
      <PageMeta
        title="Dashboard"
        description="AgriSeva-AI Multilingual AI Agricultural Advisory, Mandi Market Intelligence, and Expert Support."
      />
      <PlaygroundPage initialTab={search.tab} />
    </div>
  );
}
