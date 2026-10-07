import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToast } from "sonner";
import { NotFound } from "@/components/NotFound";
import { CookieConsent } from "@/components/CookieConsent";
import { GlobalCommunicationActions } from "@/components/GlobalCommunicationActions";
import { ContactOnboardingModal } from "@/components/ContactOnboardingModal";
import { LanguageGateway } from "@/components/LanguageGateway";
import { useLanguageStore } from "@/stores/language-store";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (
          error?.message?.includes("401") ||
          error?.message?.includes("Unauthorized") ||
          error?.status === 401 ||
          error?.status === 403
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function RootComponent() {
  const { initAuthListener } = useAuthStore();
  const isSelectorOpen = useLanguageStore((s) => s.isSelectorOpen);

  useEffect(() => {
    const unsub = initAuthListener();
    return () => {
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, [initAuthListener]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SonnerToast richColors position="bottom-right" />
        <Outlet />
        <CookieConsent />
        <GlobalCommunicationActions />
        <ContactOnboardingModal />
        {isSelectorOpen && <LanguageGateway isModal />}
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
