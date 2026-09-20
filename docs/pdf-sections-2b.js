// Section 4: Technology Stack.
module.exports = [
  function s4(H) {
    H.H1("4. Technology Stack");
    H.TABLE(
      ["Layer", "Technology", "Purpose"],
      [
        ["UI framework",      "React 19 + Vite 6", "Single-page app with fast HMR and small bundles"],
        ["UI primitives",     "Radix UI + shadcn/ui", "Accessible, headless components"],
        ["Styling",           "TailwindCSS 4", "Utility-first CSS"],
        ["Motion",            "Framer Motion + tailwindcss-animate", "Transitions, drawer animations"],
        ["Routing",           "TanStack Router (file-based)", "Type-safe routes, code-splitting"],
        ["Server state",      "TanStack Query", "Cache + retries for REST calls"],
        ["Client state",      "Zustand", "Lightweight, no boilerplate"],
        ["Forms / Validation","Zod + react-hook-form", "Schema-validated forms"],
        ["Auth (client)",     "Firebase Auth SDK", "Google + email/password"],
        ["Charts",            "Recharts", "Trends inside dashboards"],
        ["Map",               "react-leaflet", "Geo-aware views in the farmer dashboard"],
        ["Voice browser SDK", "Plivo Web SDK", "Browser SIP for callers"],
        ["i18n",              "Custom i18n hook + 22 locale files", "Indian languages"],
        ["Toast",             "sonner + react-hot-toast", "Two libraries for redundancy"],
        ["Backend HTTP",      "Express 5 + routing-controllers + InversifyJS", "Decorators, DI"],
        ["Backend TS",        "TypeScript (ESM)", "Strict mode"],
        ["Backend auth",      "Firebase Admin SDK", "JWT verification per request"],
        ["Backend jobs",      "node-cron + Google Cloud Run Jobs", "Schedules"],
        ["Backend WS",        "ws", "Voice streaming"],
        ["API docs",          "Scalar", "Auto-generated from decorators"],
        ["AI runtime",        "Python 3.11 + FastAPI + LangGraph", "Streaming agent"],
        ["LLM (primary)",     "Claude Sonnet (Anthropic)", "Reasoning"],
        ["LLM (self-hosted)", "MiniMax + Gemma", "Specialised subagents"],
        ["Embeddings",        "BAAI/bge-large-en-v1.5 (self-hosted)", "Vector retrieval"],
        ["Vector DB",         "MongoDB Atlas Vector Search", "Semantic search"],
        ["Translation / STT", "Sarvam AI", "Indian languages"],
        ["Voice (telephony)", "Plivo", "PSTN + WebRTC"],
        ["Chat",              "WhatsApp Cloud API", "Farmer chat"],
        ["Storage",           "Google Cloud Storage", "Backups, file attachments"],
        ["Observability",     "Sentry", "Errors and performance"],
        ["CI",                "GitHub Actions", "Build / test / deploy"],
        ["Containers",        "Docker + Docker Compose", "Local dev + Portainer VM"],
        ["Cron (new)",        "Cloud Run Jobs + Cloud Scheduler", "Replacing in-process node-cron"],
      ],
      { widths: [120, 180, 200], fontSize: 9, rowH: 22 }
    );
  },
];
