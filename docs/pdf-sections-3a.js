// Section 5: Repository Layout.
module.exports = [
  function s5(H) {
    H.H1("5. Repository Layout");
    H.P(
      "The repository is a monorepo of four logical services plus shared types. " +
      "Working directory: C:\\Users\\saini\\OneDrive\\Desktop\\CSP\\AgriSeva-Ai"
    );
    H.CODE(
      "AgriSeva-Ai/\n" +
      "|-- frontend/                # Vite + React 19 + TypeScript\n" +
      "|   |-- src/\n" +
      "|   |   |-- routes/          # TanStack Router file-based routes\n" +
      "|   |   |-- components/      # MainDashboardShell/Sidebar/Header/Nav\n" +
      "|   |   |-- features/        # Per-product-area code (farmerDashboard, etc.)\n" +
      "|   |   |-- hooks/api/       # Auto-generated TS client + custom wrappers\n" +
      "|   |   |-- locales/         # 22 language packs\n" +
      "|   |   |-- lib/             # utils, roles, env config\n" +
      "|   |   |-- services/        # Firebase, push, websockets\n" +
      "|   |   |-- stores/          # Zustand stores\n" +
      "|   |   |-- mocks/           # MSW handlers for dev\n" +
      "|   |   |-- config/          # Runtime / build config\n" +
      "|   |-- package.json\n" +
      "|\n" +
      "|-- backend/                 # Express 5 + routing-controllers\n" +
      "|   |-- src/\n" +
      "|   |   |-- index.ts         # Server entry\n" +
      "|   |   |-- bootstrap/       # IoC container, app factory, jobs\n" +
      "|   |   |-- modules/         # 23 modules\n" +
      "|   |   |-- shared/          # middleware, interfaces, errors\n" +
      "|   |   |-- config/          # env-driven config\n" +
      "|   |   |-- workers/         # queue workers\n" +
      "|   |   |-- utils/           # logDetails, env\n" +
      "|   |   |-- jobs/            # cron + Cloud Run jobs\n" +
      "|   |-- scripts/             # LGD sync, DB migrations\n" +
      "|-- ai/                      # Python 3.11 + FastAPI + LangGraph\n" +
      "|   |-- agriseva/agents/     # 40+ files; agriseva.py + subagents + synthesis\n" +
      "|   |-- tests/               # pytest, MCP connectivity, contracts\n" +
      "|-- mcp/                     # FastMCP tool servers (11 services)\n" +
      "|-- docs/                    # This bible + cloudrun-jobs-setup.md\n" +
      "|-- .github/workflows/       # CI / deployment workflows\n" +
      "|-- docker-compose*.yml      # Local, pull, portainer stacks\n" +
      "|-- firebase.json\n" +
      "|-- DEPLOYMENT_READINESS.md\n" +
      "|-- DEPLOYMENT_SETUP.md\n" +
      "|-- FARMER_DASHBOARD_DATA_AUDIT.md\n" +
      "|-- FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md\n" +
      "|-- Complete_Project_Architecture_and_Feature_Documentation.pdf"
    );
  },
];
