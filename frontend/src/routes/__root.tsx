import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToast } from "sonner";
import { NotFound } from "@/components/NotFound";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export const queryClient = new QueryClient();

function RootComponent() {
  const { initAuthListener } = useAuthStore();

  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SonnerToast richColors position="bottom-right" />
        <Outlet />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return <NotFound />;
  },
});
