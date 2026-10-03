// import { AuthForm } from "@/components/auth-form";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { useAuthStore } from "@/stores/auth-store";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { getRoleLandingRoute } from "@/lib/roles";

export const Route = createFileRoute("/auth/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: currentUser, isLoading } = useGetCurrentUser({ enabled: !!user });

  useEffect(() => {
    if (!user) return;
    // CRITICAL: Role resolution must happen BEFORE redirect.
    // Never navigate while the authenticated profile is still loading.
    if (isLoading) return;

    const landing = getRoleLandingRoute(
      currentUser?.role,
      currentUser?._id || user.uid,
    );
    navigate(landing as any);
  }, [user, currentUser, isLoading, navigate]);

  if (user && isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Authenticating and loading profile...
        </p>
      </div>
    );
  }

  return <AuthForm />;
}
