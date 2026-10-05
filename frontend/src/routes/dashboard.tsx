import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { isModeratorRole, isFarmerOrUserRole, getRoleLandingRoute } from "@/lib/roles";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRouteComponent,
});

function DashboardRouteComponent() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { data: currentUser, isLoading } = useGetCurrentUser({
    enabled: Boolean(user || isAuthenticated),
  });

  useEffect(() => {
    if (!authLoading && !user && !isAuthenticated) {
      navigate({ to: "/auth" });
      return;
    }
    if (isLoading) return;

    if (isModeratorRole(currentUser?.role)) {
      navigate({ to: "/moderator" });
      return;
    }

    if (isFarmerOrUserRole(currentUser?.role)) {
      navigate({ to: "/farmer" });
      return;
    }

    const landing = getRoleLandingRoute(
      currentUser?.role,
      currentUser?._id || user?.uid
    );
    navigate(landing as any);
  }, [user, isAuthenticated, authLoading, currentUser, isLoading, navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Loading Dashboard...
      </p>
    </div>
  );
}
