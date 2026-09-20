// Section 1: Executive Summary.
module.exports = [
  function s1(H) {
    H.H1("1. Executive Summary");
    H.P(
      "AgriSeva-AI is a multilingual agricultural advisory platform purpose-built for " +
      "Indian farmers. It accepts questions in twenty-two Indian languages — by text or voice — " +
      "and returns reliable, context-aware answers drawn from three sources, in order of authority."
    );
    H.UL([
      "Expert-verified answers stored in the Golden Dataset (MongoDB Atlas Vector Search).",
      "Standardised Package-of-Practices (PoP) guidelines for the relevant crop and state.",
      "AI-generated responses from a LangGraph orchestrator using Claude (Anthropic), self-hosted MiniMax, or self-hosted Gemma when no curated answer exists.",
    ]);
    H.P(
      "The platform is engineered as a three-tier system: a Vite + React frontend, a Node.js + " +
      "Express backend, and a Python + LangGraph AI agent that fans out to eleven independent MCP " +
      "tool servers (weather, market prices, soil, schemes, chemicals, knowledge base, location, " +
      "and several more). Auth is handled by Firebase; data is stored in MongoDB Atlas; voice " +
      "calls are powered by Plivo; translations and speech-to-text are handled by Sarvam AI."
    );
    H.P(
      "Beyond chat, AgriSeva-AI ships a full operations console: a Farmer Dashboard with live " +
      "mandi prices, a buyer directory, lot creation and offer workflow; a moderator and reviewer " +
      "console for the human-in-the-loop answer quality pipeline; a coordinator console for field " +
      "staff; an admin console; and observability for the entire system. The same AI agent is " +
      "reachable from a WhatsApp number and an inbound Plivo voice line, so farmers can use " +
      "whatever channel they already trust."
    );
    H.H3("Highlights as of this edition");
    H.UL([
      "28 authenticated frontend routes + a public landing/auth flow.",
      "23 backend modules, 250+ REST endpoints, all JWT-guarded by Firebase Admin SDK.",
      "1 supervisor agent + 6 subagents + 11 MCP tool servers (FastMCP).",
      "22 Indian language packs for the entire UI, with graceful English fallback.",
      "Farmer Dashboard with a 13-route surface including live mandi prices (Agmarknet + eNAM).",
      "Auth & persistence hardening complete on farmer/transaction modules — 18 new backend tests passing.",
      "Modern responsive shell: sidebar is now toggleable on every viewport (mobile, tablet, desktop).",
    ]);
    H.H3("Recent milestones");
    H.TABLE(
      ["Milestone", "Status", "Evidence"],
      [
        ["Farmer Dashboard real-data smoke-test audit",             "✅ Complete", "FARMER_DASHBOARD_DATA_AUDIT.md"],
        ["Auth + persistence hardening (x-demo-farmer-id removed)", "✅ Complete", "FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md"],
        ["Sidebar toggleable on mobile/tablet/desktop",             "✅ Complete", "Frontend HMR confirmed via docs/."],
        ["i18n coverage expansion to 22 languages",                  "✅ Complete", "frontend/src/locales/*"],
        ["Cloud Run Jobs migration for backup + queue crons",       "✅ Complete", ".github/workflows/cloudrun-jobs-deployment.yml"],
        ["Deployment readiness audit + secret hygiene",              "✅ Complete", "DEPLOYMENT_READINESS.md"],
        ["Payment-gateway integration",                             "⚠ Deferred",  "Records without real gateway"],
        ["Real buyer KYC",                                          "⚠ Deferred",  "Seeded catalog only"],
      ]
    );
  },
];
