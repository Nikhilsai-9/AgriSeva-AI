// Sections 23 + 24: Tech Debt + Metrics.
module.exports = [
  function s23_24(H) {
    // 23 Tech Debt
    H.H1("23. Tech Debt & Known Limitations");
    H.TABLE(
      ["#", "Limitation", "Layer", "Mitigation"],
      [
        ["1", "name field on farmer profile form is not persisted (lives on IUser.firstName/lastName)", "Frontend", "Follow-up: add PATCH /users/me/name next to farmer-profile"],
        ["2", "Seed data contains the literal 'demo-farmer-uid' string in a non-auth context (seed loader)", "Backend", "Cosmetic; not used as auth trust. Safe to remove on next seed refactor."],
        ["3", "Notification fan-out is fire-and-forget (no transactional rollback)", "Backend", "Acceptable: event-driven. Documented."],
        ["4", "vitest unit tests mock Firebase tokens; real e2e requires sandbox cluster", "QA", "Tracked under pending #12."],
        ["5", "558 pre-existing TypeScript errors in unrelated files (frontend)", "Code health", "Out of scope for this edition; filter out for now."],
        ["6", "5xx on Agmarknet upstream will surface as prices error in /farmer/prices", "MCP", "Backed by marketPriceSnapshots so the error is recoverable on next refresh."],
        ["7", "PNG previews of the responsive shell not committed to docs/", "Docs", "Will be added after manual browser-verification"],
      ],
      { widths: [30, 250, 80, 230] }
    );

    // 24 Metrics
    H.H1("24. Repository Metric Snapshot");
    H.P("Counts derived from the working tree at the time of this PDF. Useful for sizing decisions.");
    H.TABLE(
      ["Tree", "Files"],
      [
        ["Frontend routes",                        "28"],
        ["Frontend feature areas",                 "13"],
        ["Frontend locale packs",                  "22"],
        ["Backend modules",                        "23"],
        ["AI subagent / synthesis files",          "~40 Python files under agriseva/agents/"],
        ["MCP tool servers",                       "11"],
        ["Top-level project docs",                 "README + DEPLOYMENT_SETUP + DEPLOYMENT_READINESS + FARMER_DASHBOARD_DATA_AUDIT + FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING + cloudrun-jobs-setup + this Bible"],
        ["Cloud Run Jobs (migrated)",              "2 (+ 1 net-new lgd-sync)"],
        ["Cloud Run Jobs (legacy cron to migrate)","6"],
        ["Farmer dashboard routes",                "13"],
        ["i18n languages",                         "22"],
        ["Test suites added (this edition)",       "3 new files, 18 new tests"],
        ["Lines touched by auth hardening",        "+876 / -177"],
        ["Sidebar edition files modified",         "5 (4 components + .npmrc)"],
      ],
      { widths: [240, 200] }
    );
  },
];
