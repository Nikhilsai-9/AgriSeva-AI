// Sections 17 + 18 + 19: CI/CD + Testing + Observability/Security.
module.exports = [
  // 17 CI/CD
  function s17(H) {
    H.H1("17. CI / CD");
    H.UL([
      ".github/workflows/build_and_deploy_reviewer.yml — builds and deploys the reviewer backend.",
      ".github/workflows/cloudrun-jobs-deployment.yml — deploys / updates / executes Cloud Run Jobs (with target_job input).",
      ".firebaserc + firebase.json — Firebase Hosting targets.",
      "Scalar-generated OpenAPI surfaces the backend contract for downstream consumers (frontend client, external integrators).",
    ]);
  },

  // 18 Testing
  function s18(H) {
    H.H1("18. Testing");
    H.H2("18.1  Frontend");
    H.UL([
      "Vitest for unit + component tests; pnpm run test.",
      "@testing-library/react for component testing.",
      "MSW for request mocking in dev + tests.",
    ]);
    H.H2("18.2  Backend");
    H.UL([
      "Vitest with Vitest UI; pnpm run test (UI), pnpm run test:ci (coverage + HTML report).",
      "Per-module tests under each module's tests/ folder.",
      "Recent additions:",
      "  - tests/transaction/TransactionAuth.test.ts — 9/9 (auth, ownership, header-forgery).",
      "  - tests/user/UserProfile.test.ts — 5/5 (GET, PATCH, round-trip, dedup, 401).",
      "  - tests/notification/NotificationFlow.test.ts — 4/4 (envelope, mark-all-read, mark-single-read, 401).",
      "  - tests/marketIntelligence/MarketPricesController.test.ts — 17/17 (Agmarknet path).",
    ]);
    H.H2("18.3  AI agent");
    H.UL([
      "pytest under ai/.",
      "tests/api/run_api_contracts.py — API contract fuzz tests.",
      "tests/mcp/mcp_connectivity.py — connectivity probes for every MCP URL.",
      "evaluation/ harness (deepeval + langsmith + custom plan-based scoring).",
    ]);
  },

  // 19 Observability + Security + Compliance
  function s19(H) {
    H.H1("19. Observability, Security, Compliance");
    H.H2("19.1  Observability");
    H.UL([
      "Sentry for backend error + performance tracking. sentry:sourcemaps script uploads release artifacts.",
      "Module-level logger via utils/logDetails.ts (PII-safe).",
      "LangGraph thread logs persisted to MongoDB (thread_log_mongo.py) for every agent run.",
      "Vertex AI / LangSmith integration in evaluation/ when keys are provided.",
    ]);
    H.H2("19.2  Security model");
    H.UL([
      "All secrets live in .env (gitignored). .env.example files contain placeholders only.",
      "Per-request Firebase JWT verification — never trust a client-supplied header.",
      "CORS allow-list driven by APP_ORIGINS.",
      "Service-to-service trust via INTERNAL_API_KEY.",
      "Containerised services are reachable only via Tailscale or the cluster network.",
      "All write paths emit an audit trail entry (auditTrails collection).",
    ]);
    H.H2("19.3  Compliance & disclaimers");
    H.UL([
      "PrivacyPage + TermsPage explain that buyer KYC is not yet integrated and payments are records only.",
      "FarmerLayout demo banner now reflects the truthful live-persisted-mixed boundary.",
      "Agmarknet + eNAM data attribution displayed on farmer price UI.",
    ]);
  },
];
