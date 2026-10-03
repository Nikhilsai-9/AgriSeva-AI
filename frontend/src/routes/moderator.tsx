import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { isModeratorRole, getRoleLandingRoute } from "@/lib/roles";
import { toast } from "sonner";
import { PlaygroundPage } from "@/components/play-ground";
import { PageMeta } from "@/components/PageMeta";
import { useTranslation } from "@/locales";

export const Route = createFileRoute("/moderator")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: currentUser, isLoading } = useGetCurrentUser({ enabled: !!user });

  useEffect(() => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (isLoading) return;

    if (!isModeratorRole(currentUser?.role)) {
      toast.error(
        t("errors.accessDenied", "Access denied. Moderator privileges required.")
      );
      const landing = getRoleLandingRoute(
        currentUser?.role,
        currentUser?._id || user.uid
      );
      navigate(landing as any);
    }
  }, [user, currentUser, isLoading, navigate, t]);

  if (!user || isLoading || !isModeratorRole(currentUser?.role)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("common.verifyingAccess", "Verifying moderator access...")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-2 sm:px-4 py-2 sm:py-4 relative flex flex-col">
      <PageMeta
        title="Moderator Dashboard"
        description="AgriSeva-AI Content Moderation, Quality Assurance, and System Performance."
      />
      <PlaygroundPage initialTab="performance" />
    </div>
  );
}
