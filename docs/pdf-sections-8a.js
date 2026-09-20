// Section 14 part 1: Admin/Moderator, Reviewer/Expert, Gate Keeper, Coordinator.
module.exports = [
  function s14a(H) {
    H.H1("14. Surface-by-Surface Feature Inventory");
    H.P(
      "This section enumerates every user-facing capability for every persona. For the Farmer dashboard, " +
      "the data source verdict column comes from the live smoke-test audit " +
      "(FARMER_DASHBOARD_DATA_AUDIT.md)."
    );
    H.H2("14.1  Admin & Moderator");
    H.TABLE(
      ["Feature", "Where", "Notes"],
      [
        ["User management",          "/user/:userId",      "List, search, change role, ban."],
        ["Submission history",       "/history",           "Filterable history of every submission."],
        ["Per-user history",         "/user/:userId/history","Drilldown of an individual user's work."],
        ["Audit trail",              "/audit",             "Tamper-evident log viewer."],
        ["Flags reported",           "/flags-reported",     "Triages flagged questions."],
        ["ChatBot analytics",        "/chatbot",           "Volume, latency, sentiment over time."],
        ["Notifications",            "/notifications",     "System alerts."],
        ["Profile menu",             "Header",             "Switch language, sign out."],
      ],
      { widths: [150, 130, 240] }
    );
    H.H2("14.2  Reviewer / Expert / PAE-Expert");
    H.UL([
      "/pae-expert — full-page authoring surface for PAE experts (draft, save, request review).",
      "Reviewer console (pae-expert-page feature) — read incoming AI drafts, accept, rewrite, or reject.",
      "/home (Submission history) for experts to look up their own past submissions.",
      "Approval pipeline is human-in-the-loop: every AI-generated answer that goes out is also enqueued for expert review.",
    ]);
    H.H2("14.3  Gate Keeper / Auditor");
    H.UL([
      "/audit — full audit trail with per-action filters.",
      "/flags-reported — flagged questions queue.",
      "Quality console (gate-keeper auditor queue) — automated via gateKeeperAuditorQueueCron cron -> Cloud Run Job gate-keeper-auditor-queue (* * * * *).",
    ]);
    H.H2("14.4  Coordinator (district / block / village)");
    H.UL([
      "/coordinator — field-ops home with the staff list, allocations and reporting dashboard of their geo scope.",
      "/coordinator/profile — coordinator profile editor.",
      "Coordinators do not see the global admin nav — visibleFor in MainDashboardNav filters to /coordinator only.",
    ]);
  },
];
