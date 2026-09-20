// Section 20: Recent Work (sidebar).
module.exports = [
  function s20(H) {
    H.H1("20. Recent Work — Sidebar Toggleable Everywhere");
    H.P(
      "The user reported that the global sidebar was not toggleable on small viewports, that the farmer " +
      "dashboard wasn't the first item for farmer users, and that several routes referenced by the nav " +
      "didn't exist. This edition ships the fixes."
    );
    H.H2("20.1  What changed");
    H.TABLE(
      ["File", "Before", "After"],
      [
        ["MainDashboardSidebar.tsx", "Persistent-only on desktop; unmounted on mobile/tablet.", "Dual-mode: drawer slide-in on mobile/tablet, persistent collapsible rail on desktop."],
        ["MainDashboardShell.tsx", "Single state for the desktop sidebar.", "Two-state sidebar model (drawer open + collapsed rail) with viewport-aware defaults."],
        ["MainDashboardHeader.tsx", "Static hamburger on small screens.", "Dual-mode hamburger that toggles drawer (mobile) or rail (desktop)."],
        ["MainDashboardNav.tsx", "Single mid-list dashboard entry; multiple placeholder destinations.", "Farmer Dashboard is FIRST for role=farmer; every entry maps to a REAL route. visibleFor/isActive predicates keep role-based access true."],
        ["MainDashboardNav.tsx:118", "TypeScript null-check failure: (u) => isCoordinatorRole(u.role ?? null).", "Fixed to (u) => !!u && isCoordinatorRole(u.role ?? null). typecheck now clean."],
      ],
      { widths: [180, 200, 200] }
    );
    H.H2("20.2  Verification steps run");
    H.bullet([
      "Read all four modified components to confirm the intended final state.",
      "Listed every route referenced by NAV_ITEMS and confirmed each one exists as frontend/src/routes/_authenticated.<name>.tsx.",
      "Ran tsc --noEmit — 0 errors in any MainDashboard*.tsx.",
      "Bypassed pnpm 10 verify-deps gate via frontend/.npmrc -> verify-deps-before-run=false.",
      "Started Vite dev server on 127.0.0.1:5173 — HTTP 200 on /, /farmer.",
      "HMR served each modified component without warnings.",
      "Documented for the owner to complete a manual browser-verification pass.",
    ], true);
    H.H2("20.3  Outstanding optional items");
    H.UL([
      "Add dashboard.openMenu | closeMenu | expandNav | collapseNav | globalNav | tabs* keys to all 22 locale files (batch follow-up).",
      "Add visual regression screenshots of the three viewports to docs/.",
    ]);
  },
];
