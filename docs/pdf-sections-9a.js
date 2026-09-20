// Sections 15 + 16: Jobs + Deployment.
module.exports = [
  function s15_16(H) {
    // 15 Jobs
    H.H1("15. Background Jobs — Legacy + Cloud Run Jobs");
    H.P(
      "The system uses node-cron inside the backend for some jobs and Google Cloud Run Jobs (driven by " +
      "Cloud Scheduler) for everything that should not be tied to a single long-running instance. The " +
      "GitHub workflow .github/workflows/cloudrun-jobs-deployment.yml deploys both new and migrated jobs."
    );
    H.TABLE(
      ["Job (cron syntax)", "Status", "How it runs"],
      [
        ["backup-db (0 8,19 * * *)",         "✅ Migrated", "Cloud Run Job + Cloud Scheduler"],
        ["gate-keeper-auditor-queue (* * * * *)", "✅ Migrated", "Cloud Run Job + Cloud Scheduler"],
        ["lgd-sync (0 3 * * 0, IST)",        "✅ Net-new",  "Cloud Run Job, weekly on Sunday 03:00"],
        ["moderator-queue (every 1 min)",    "⚠ Legacy",    "node-cron (in-process) — pending migration"],
        ["time-bound-reallocate (1 min)",    "⚠ Legacy",    "node-cron — pending"],
        ["question-status (1 min)",          "⚠ Legacy",    "node-cron — pending"],
        ["agent-status-cleanup (1 min)",     "⚠ Legacy",    "node-cron — pending"],
        ["daily-report (twice daily)",       "⚠ Legacy",    "node-cron — pending"],
        ["notification-delete (02:00 daily)","⚠ Legacy",    "node-cron — pending"],
      ],
      { widths: [220, 90, 200] }
    );
    H.H2("15.1  Cloud Run Jobs deployment pipeline");
    H.UL([
      "docs/cloudrun-jobs-setup.md is the step-by-step runbook for the one-time GCP setup.",
      "Each Job gets its own empty service account by least privilege (most Jobs only need Mongo access).",
      "Per-Job secrets are injected as env vars; GitHub Actions secrets/Variables are the source of truth.",
      "Manual smoke-test path: gcloud run jobs execute <name> --region=<region> --wait then check logs and the bucket.",
    ]);

    // 16 Deployment
    H.H1("16. Deployment");
    H.H2("16.1  Local dev with Docker Compose");
    H.UL([
      "docker-compose.yml — bring up Postgres, Redis and the agent API.",
      "docker-compose.mcp.yml — bring up the MCP tool servers.",
      "docker-compose.app.yml — full app stack (frontend nginx + backend + agent).",
      "aegra up / aegra dev for the agent's hot-reload loop.",
    ]);
    H.H2("16.2  Pre-built images — Portainer / VM");
    H.UL([
      "docker-compose.pull.yml — pulls pre-built images.",
      "docker-compose.pull-build.yml — pull-then-build for hybrid environments.",
      "Set stack secrets in Portainer; never override DATABASE_URL with a host port.",
    ]);
    H.H2("16.3  Firebase Hosting");
    H.UL([
      "Site names: agriseva-prod and agriseva-staging-594 (registered, cannot rename without new sites).",
      "firebase.json — hosting config with SPA fallback to index.html.",
      ".firebaserc — multi-project registry.",
    ]);
    H.H2("16.4  Production readiness checklist (from DEPLOYMENT_READINESS.md)");
    H.TABLE(
      ["#", "Blocker", "What's needed"],
      [
        ["1", "Firebase credentials not configured", "Project ID + web config + service-account JSON"],
        ["2", "MongoDB Atlas URI missing",           "DB_URL connection string + DB_NAME"],
        ["3", "Anthropic API key missing",           "ANTHROPIC_API_KEY"],
        ["4", "MiniMax not configured",              "MINIMAX_BASE_URL + MINIMAX_API_KEY"],
        ["5", "Embedding endpoint missing",          "GOLDEN_EMBEDDING_ENDPOINT"],
        ["6", "REMOTE_IP not set",                   "Tailscale IP of the self-hosted services node"],
        ["7", "MCP servers not running",             "All FastMCP services reachable"],
        ["8", "Docker images not built",             "Build locally or push to Docker Hub"],
      ],
      { widths: [30, 160, 280] }
    );
  },
];
