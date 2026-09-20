// Section 6 part 2: Layout, sidebar work, state/i18n.
module.exports = [
  function s6b(H) {
    H.H2("6.3  Global layout (the four pillars)");
    H.P(
      "The authenticated experience is composed of exactly four layout components. " +
      "Together they form a single responsive shell that is identical from any starting route."
    );
    H.UL([
      "MainDashboardShell — orchestrates the sidebar drawer on mobile, the collapsible sidebar rail on desktop, the top header bar and the main content slot.",
      "MainDashboardSidebar — the persistent vertical nav for >=1024px and the slide-in drawer for mobile/tablet; collapses to a 68-72px rail with icon-only tooltips.",
      "MainDashboardHeader — brand + primary horizontal nav (>=md), notifications bell, profile menu, language switcher, hamburger that toggles the sidebar.",
      "MainDashboardNav — single source of truth for the visible nav list per role (NAV_ITEMS) and per-role homeRouteFor(user).",
    ]);
    H.P(
      "Child layouts (e.g. FarmerLayout) are layered inside the global shell so the brand row, " +
      "sign-out, profile menu and language switcher are provided exactly once for the whole app."
    );
    H.H2("6.4  Recent UI work — Sidebar toggleable everywhere");
    H.UL([
      "Before: persistent-only on desktop; sidebar and tab strip cramped on <=1023px.",
      "After: hamburger in the header toggles a slide-in drawer on mobile/tablet (<=1023px) and collapses the persistent sidebar to a 68-72px rail on desktop with a width transition.",
      "Implementation: new dual-mode state in MainDashboardShell.tsx; icon button in MainDashboardHeader calls sidebar.toggle(); MainDashboardSidebar renders either the drawer variant or the persistent rail.",
      "Single nav source: NAV_ITEMS in MainDashboardNav.tsx is consumed by both sidebar and header.",
      "Role-aware first item: Farmer Dashboard is the first entry for users with role=farmer.",
      "i18n: drawer/expand/collapse labels fall back to English strings via t(key, fallback); ready to be replaced with locale keys batch-wise.",
      "One-line fix in this iteration: a strict null narrowing on the isCoordinatorRole callback (MainDashboardNav.tsx:118) prevented the typecheck from passing — resolved with !!u &&.",
      "Local verification: Vite dev server (127.0.0.1:5173) returns HTTP 200 on /, /farmer, and the four modified components transpile cleanly.",
    ]);
    H.H2("6.5  State, data and i18n");
    H.UL([
      "TanStack Query for all REST fetches; optimistic updates on offer/lot mutations.",
      "Zustand for ephemeral UI state (drawer open, current filter, language preference mirror).",
      "22 language locales under frontend/src/locales/*.ts plus an English fallback baked into t(key, fallback).",
      "MSW mocks under src/mocks for offline dev; gated by VITE_ENABLE_MOCKS.",
      "Auto-generated TS client under src/client wraps every backend controller.",
    ]);
  },
];
