// Section 21: DONE inventory.
module.exports = [
  function s21(H) {
    H.H1("21. Done — Complete Inventory");
    H.TABLE(
      ["Area", "Workstream", "Status", "Evidence"],
      [
        ["Frontend", "Farmer Dashboard surface (13 routes)",        "✅ Complete", "frontend/src/features/farmerDashboard/*"],
        ["Frontend", "Coordinator console",                          "✅ Complete", "routes/_authenticated.coordinator.*"],
        ["Frontend", "PAE-Expert authoring",                         "✅ Complete", "routes/_authenticated.pae-expert.tsx"],
        ["Frontend", "Moderator / Auditor / Admin consoles",         "✅ Complete", "routes/_authenticated.{home,audit,flags-reported,history,chatbot}.tsx"],
        ["Frontend", "Per-user profile + history",                   "✅ Complete", "routes/_authenticated.user.$userId.tsx + user-history.$userId.tsx"],
        ["Frontend", "Responsive shell with toggleable sidebar",      "✅ Complete", "MainDashboardShell/Sidebar/Header/Nav"],
        ["Frontend", "22-language i18n",                             "✅ Complete", "frontend/src/locales/*"],
        ["Backend",  "Auth + persistence hardening",                  "✅ Complete", "FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md"],
        ["Backend",  "x-demo-farmer-id removed",                     "✅ Complete", "Same"],
        ["Backend",  "Notification fan-out for transaction events",   "✅ Complete", "NotificationService.saveTheNotifications(...)"],
        ["Backend",  "OpenAPI / Scalar doc generation",              "✅ Complete", "backend/scripts/generate-openapi.cjs"],
        ["Backend",  "Cloud Run Jobs migration for backup + queue",   "✅ Complete", ".github/workflows/cloudrun-jobs-deployment.yml + docs/cloudrun-jobs-setup.md"],
        ["AI",       "Supervisor + 6 subagents",                      "✅ Complete", "ai/agriseva/agents/*"],
        ["AI",       "Planner orchestrator (default)",                "✅ Complete", "planner.py + plan_executor.py"],
        ["AI",       "Translation pipeline (Sarvam)",                  "✅ Complete", "translate_answer.py + language.py"],
        ["AI",       "WhatsApp + Plivo channel wiring",               "✅ Complete", "backend chatbot/ + plivo/"],
        ["MCP",      "11 tool servers",                               "✅ Complete", "mcp/mcp_containers/"],
        ["MCP",      "Agmarknet + eNAM mandi scraping",               "✅ Complete", "marketIntelligence/ + agmarknet-mcp/"],
        ["Infra",    "Secret hygiene (.env vs .env.example)",         "✅ Complete", "DEPLOYMENT_READINESS.md"],
        ["Infra",    "CORS driven by APP_ORIGINS",                    "✅ Complete", "shared/middleware/corsHandler.ts"],
        ["Infra",    "CI build + deploy workflows",                   "✅ Complete", ".github/workflows/*"],
        ["Doc",      "README, DEPLOYMENT_SETUP, DEPLOYMENT_READINESS","✅ Complete", "Top-level .md files"],
        ["Doc",      "Farmer audit + hardening report",               "✅ Complete", "FARMER_DASHBOARD_DATA_AUDIT.md + FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md"],
        ["Doc",      "This Project Bible",                            "✅ Complete", "docs/project-bible.pdf"],
      ],
      { widths: [80, 220, 90, 180] }
    );
  },
];
