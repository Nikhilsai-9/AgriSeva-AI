# AgriSeva-AI — Deployment Readiness Report

_Generated: Phase 1 — Codebase audit, rename, and environment configuration_

---

## 1. Project Architecture

```
agriseva/
├── frontend/          Vite + React 19 + TypeScript + TailwindCSS 4
├── backend/           Node.js + Express 5 + TypeScript (routing-controllers + InversifyJS)
├── ai/                Python 3.10+ + LangGraph + FastAPI (AI agent)
├── apis/              Supporting Python microservices (proxy, IMD weather wrapper, acc-api, ans-gen)
├── mcp/               FastMCP servers (weather, market, soil, POP, golden-dataset, etc.)
├── docs/              Project documentation
└── research/          Academic references
```

---

## 2. Frontend

| Item | Value |
|---|---|
| Framework | Vite 6 + React 19 + TypeScript |
| UI library | Radix UI + shadcn/ui, TailwindCSS 4, Framer Motion |
| Routing | TanStack Router |
| State | Zustand + TanStack Query |
| Auth | Firebase Auth (Google + email/password) |
| API client | Auto-generated OpenAPI TypeScript client |
| Voice | Plivo Browser SDK + Sarvam AI (STT/TTS) |
| Entry point | `frontend/src/main.tsx` |
| Dev command | `cd frontend && pnpm run dev` (port 5173) |
| Build command | `cd frontend && pnpm run build` |
| Config file | `frontend/src/config/env.ts` (centralized env getter) |
| Runtime config | `runtime-config.js` (Docker: vars injected at container start) |

---

## 3. Backend

| Item | Value |
|---|---|
| Framework | Express 5 + routing-controllers + InversifyJS |
| Language | TypeScript (compiled to ESM) |
| Entry point | `backend/src/index.ts` |
| Dev command | `cd backend && pnpm run dev` (port 3141) |
| Start command | `cd backend && node build/index.js` |
| Build command | `cd backend && pnpm run build` |
| Config layer | `backend/src/config/` (centralized; uses `env()` utility) |
| CORS | Driven by `APP_ORIGINS` env var |
| Auth | Firebase Admin SDK (JWT verification per request) |
| Background jobs | `node-cron` (backup, cleanup) |
| WebSocket | Custom WS server (voice streaming) |
| API docs | Scalar (auto-generated from routing-controllers decorators) |

### Backend modules discovered

- `auth` — Firebase-based authentication
- `user` — User management, roles (Admin / PAE / Reviewer / Farmer)
- `question` — Core Q&A review workflow
- `answer` — Answer management
- `chatbot` — WhatsApp/voice chatbot integration
- `ai` — AI service proxy to LangGraph agent
- `crop` — Crop data
- `chemical` — Chemical/pesticide registry
- `whatsapp` — WhatsApp webhook handling
- `plivo` — Voice call handling
- `notification` — Push notification service
- `lgd` — Location data (LGD normalization)
- `dashboard` — Analytics dashboard
- `acc-agent` — Human-in-the-loop ACC agent integration
- `reroute` — Question re-routing
- `performance` — Performance metrics
- `context` — Call context management

---

## 4. Database Currently Used

| Database | Purpose | Technology |
|---|---|---|
| Primary | Questions, answers, users, reviews, sessions | MongoDB Atlas (NoSQL) |
| Analytics | Reporting and dashboards | MongoDB Atlas (separate cluster) |
| WhatsApp logs | Per-conversation thread logs | MongoDB Atlas (same or separate) |
| AI checkpoints | LangGraph state persistence | PostgreSQL (asyncpg) |
| Vector search | Semantic question retrieval | MongoDB Atlas Vector Search (built-in) |

**MongoDB Collection key names**:
- `questions`, `answers`, `users`, `requestfeedbacks`, `contexts`, `notifications`
- `langgraph_log` (AI thread logs)
- `crop_master` (crop chemical lookup)

---

## 5. AI/LLM Provider

| Role | Provider | Model |
|---|---|---|
| Translation, follow-up quality | Anthropic | `claude-sonnet-4-6` (configurable via `CLAUDE_MODEL`) |
| Fast tasks (routing, classification) | Anthropic | `claude-haiku-4-5-20251001` (configurable via `CLAUDE_FAST`) |
| Planner, synthesizer, sanitizer, crop classify | MiniMax (self-hosted) | `MiniMaxAI/MiniMax-M2.7` (configurable via `MINIMAX_MODEL`) |
| Weather agent, market agent | Gemma (self-hosted) | configurable via `GEMMA_BASE_URL` / `WEATHER_GEMMA_BASE_URL` |
| Daily price agent | Gemma (self-hosted) | same as above |

---

## 6. RAG / Vector Store

| Component | Technology | Config variable |
|---|---|---|
| Embedding model | BAAI/bge-large-en-v1.5 (self-hosted) | `GOLDEN_EMBEDDING_ENDPOINT` |
| Vector database | MongoDB Atlas Vector Search | `GOLDEN_MONGODB_URI`, `GOLDEN_MONGODB_INDEX` |
| Document collection | `questions` (agriai DB) | `GOLDEN_MONGODB_DATABASE`, `GOLDEN_MONGODB_COLLECTION` |
| Retrieval top-k | 5 (configurable) | `GOLDEN_RAG_TOP_K` |
| Similarity threshold | LLM classifier | `GOLDEN_TIE_BREAK_MIN` |
| Crop master | In-memory Python dict (loaded from MongoDB) | `GOLDEN_CROP_CHEMICAL_NAME_PATH` |

---

## 7. External APIs

| Service | Purpose | Config Variable(s) | Mandatory? |
|---|---|---|---|
| Firebase Auth | User authentication | `FIREBASE_*` (server) + `VITE_FIREBASE_*` (client) | ✅ Yes |
| Firebase Hosting | Static frontend hosting | Firebase CLI + `.firebaserc` | Optional (can use nginx) |
| Anthropic API | Claude LLM | `ANTHROPIC_API_KEY` | ✅ Yes |
| Sarvam AI | Speech-to-text, translation | `SARVAM_API_KEY`, `VITE_SARVAM_API_KEY` | Optional |
| Plivo | Voice calling | `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_NUMBER`, `PLIVO_STREAM_URL` | Optional |
| Google Cloud Storage | File storage, DB backups | `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_BACKUP_BUCKET` | Optional |
| Sentry | Error tracking | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Optional |
| data.gov.in (LGD) | Village/district/state lookup | `LGD_API_KEY` | Optional |
| SMTP | Email notifications | `SMTP_USER`, `SMTP_PASS` | Optional |
| OpenWeather | Weather data (fallback) | `OPENWEATHER_API_KEY` | Optional |
| agmarknet.gov.in | Market price data | `AGMARKNET_BASE_URL` | Optional |
| enam.gov.in | eNAM market data | `ENAM_BASE_URL` | Optional |
| Fast2SMS | SMS notifications | `FAST2SMS_API_KEY` | Optional |

### Self-hosted (internal Tailscale infrastructure)

| Service | Purpose | Config |
|---|---|---|
| MiniMax LLM | Planner/synthesizer LLM | `MINIMAX_BASE_URL`, `MINIMAX_API_KEY` |
| Gemma LLM | Weather/market agents | `GEMMA_BASE_URL`, `WEATHER_GEMMA_BASE_URL` |
| Embedding server | BGE-large embeddings | `GOLDEN_EMBEDDING_ENDPOINT` |
| Agent search | Q&A similarity search | `AGENT_SEARCH_URL` |
| Golden API | RAG retrieval API | `GOLDEN_API_URL` |
| LangGraph server | AI agent runtime | `LANGRAPH_SERVER_IP`, `LANGRAPH_SERVER_PORT` |
| IMD weather | Indian weather data | `IMD_CITY_BASE`, `IMD_MAUSAM_BASE` |
| MCP servers | Tool endpoints (9 servers) | `REMOTE_IP` (base for all MCP URLs) |

---

## 8. Authentication

- **Provider**: Firebase Auth
- **Methods**: Google OAuth, email/password
- **Backend validation**: Firebase Admin SDK (`verifyIdToken`)
- **Frontend**: Firebase client SDK (`firebase/auth`)
- **Roles**: Admin, PAE (Primary Agricultural Expert), Reviewer, Farmer

---

## 9. Storage

- **Google Cloud Storage (GCS)**: anomaly data, face data, AI server artifacts
- **MongoDB GridFS**: not used (files stored externally)
- **Local filesystem**: log files (`logs/` directory in AI service)

---

## 10. Required Environment Variables (to fill before deployment)

### Critical — will fail without these

```
# Backend
DB_URL                       MongoDB connection string
FIREBASE_PROJECT_ID          Firebase project ID
FIREBASE_CLIENT_EMAIL        Firebase service account email
FIREBASE_PRIVATE_KEY         Firebase service account private key
FIREBASE_API_KEY             Firebase API key
ADMIN_PASSWORD               Initial admin password
INTERNAL_API_KEY             Service-to-service auth (openssl rand -hex 32)
APP_ORIGINS                  Comma-separated allowed CORS origins

# AI Agent
ANTHROPIC_API_KEY            Anthropic Claude API key
MINIMAX_API_KEY              MiniMax model API key
MINIMAX_BASE_URL             MiniMax OpenAI-compatible endpoint URL
GOLDEN_MONGODB_URI           MongoDB URI for RAG dataset
GOLDEN_EMBEDDING_ENDPOINT    Self-hosted embedding server URL
REMOTE_IP                    Internal IP of MCP/LLM server node

# Frontend
VITE_API_BASE_URL            Backend API URL (/api for same-origin, full URL for separate)
VITE_FIREBASE_API_KEY        Firebase web app config
VITE_FIREBASE_AUTH_DOMAIN    Firebase web app config
VITE_FIREBASE_PROJECT_ID     Firebase web app config
VITE_FIREBASE_STORAGE_BUCKET Firebase web app config
VITE_FIREBASE_MESSAGING_SENDER_ID  Firebase web app config
VITE_FIREBASE_APP_ID         Firebase web app config
```

### Optional — features degraded without these

```
SARVAM_API_KEY               Voice/translation features
VITE_SARVAM_API_KEY          Frontend voice input
PLIVO_AUTH_ID / _TOKEN / _NUMBER  Voice calling
VAPID_PUBLIC_KEY / PRIVATE_KEY    Push notifications
SMTP_USER / SMTP_PASS        Email notifications
SENTRY_DSN                   Error tracking
GCP_BACKUP_BUCKET            Automatic DB backups
OPENWEATHER_API_KEY          Weather fallback
LGD_API_KEY                  Location normalization
AGENT_SEARCH_URL             Q&A similarity search feature
```

---

## 11. Public Variables (safe to expose in frontend bundle)

All `VITE_*` variables — they are baked into the browser bundle.

**Note**: `VITE_SARVAM_API_KEY` is exposed in the browser. This is acceptable if the Sarvam key is restricted to your domain via the Sarvam console.

---

## 12. Private Variables (must NEVER reach the browser)

All backend-only variables, especially:
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `DB_URL`
- `ANTHROPIC_API_KEY`
- `MINIMAX_API_KEY`
- `INTERNAL_API_KEY`
- `ADMIN_PASSWORD`
- `VAPID_PRIVATE_KEY`
- `SMTP_PASS`
- `PLIVO_AUTH_TOKEN`
- `SENTRY_AUTH_TOKEN`

---

## 13. Old Project Name Occurrences Changed

| File | Change |
|---|---|
| `frontend/index.html` | Title: `AgriSeva-AI - Review system` → `AgriSeva-AI` |
| `frontend/index.html` | Meta description updated |
| `backend/src/utils/logDetails.ts` | Startup banner: `ViBe REST API Startup Summary` → `AgriSeva-AI Backend Startup Summary` |
| `backend/src/shared/middleware/corsHandler.ts` | Removed hardcoded `vibe-5b35a.web.app`; now reads from `appConfig.origins` |
| `backend/package.json` | `name`: `vitest-vibe` → `agriseva-ai-backend` |
| `ai/pyproject.toml` | `name`: `agriseva-ai` → `agriseva-ai`, description updated |
| `README.md` | Full rename AgriSeva-AI → AgriSeva-AI |
| `backend/.env.example` | Header updated |
| `frontend/.env.example` | Header updated |
| `ai/.env.example` | Full rewrite with AgriSeva-AI branding |
| `.env.example` (root) | Full rewrite with AgriSeva-AI branding |
| `DEPLOYMENT_SETUP.md` | Created (new file) |

---

## 14. Legacy Identifiers Left Unchanged and Why

| Identifier | Location | Reason |
|---|---|---|
| `agriseva/` Python package directory | `ai/agriseva/` | Python package name = directory name; renaming breaks all internal imports without a coordinated refactor |
| `from agriseva.agents...` imports | All `ai/**/*.py` | Same as above — Python import system |
| `AgriSevaState` class name | `ai/agriseva/agents/state.py` | Internal type name; safe to rename later separately |
| `QUESTION_SOURCE=AGRISEVA_AI` | `ai/.env.example`, `ai/agriseva/agents/config.py` | Data-channel identifier stored in MongoDB documents — renaming requires a DB migration |
| `reviewer-backend` / `reviewer-frontend` container names | docker-compose files | Docker container names; harmless for deployment, can be changed later |
| `agriseva/reviewer-api` Docker image name | `docker-compose.pull.yml` | Docker Hub image path; cannot change without rebuilding and re-pushing |
| `.firebaserc` site names `agriseva-prod`, `agriseva-staging-594` | `.firebaserc` | Firebase Hosting site names registered in Firebase Console — requires user action to update |
| `vibe-5b35a` Firebase project ID | `.firebaserc` | Actual Firebase project ID; tied to the real Firebase project |
| `100.100.108.x` Tailscale IP defaults | Various `os.getenv(..., "100.100.108.x")` | Self-hosted infrastructure defaults; all are properly wrapped in `os.getenv(...)` so they are overridable via env vars |

---

## 15. Hardcoded Configuration Removed / Made Environment-Driven

| What | Where | Fix |
|---|---|---|
| `https://vibe-5b35a.web.app` in CORS handler | `backend/src/shared/middleware/corsHandler.ts` | Now reads from `appConfig.origins` (env: `APP_ORIGINS`) |
| `http://100.100.108.44:6002/search` | `backend/src/modules/question/services/QuestionService.ts` | Replaced with `aiConfig.agentSearchUrl + '/search'` (env: `AGENT_SEARCH_URL`) |
| `http://100.100.108.44:6002/extract` | `backend/src/modules/question/services/QuestionService.ts` | Replaced with `aiConfig.agentSearchUrl + '/extract'` (env: `AGENT_SEARCH_URL`) |

---

## 16. Files Created / Updated

### Created
- `DEPLOYMENT_SETUP.md` — comprehensive deployment guide
- `DEPLOYMENT_READINESS.md` — this file

### Updated
- `README.md`
- `.env.example` (root)
- `frontend/index.html`
- `frontend/.env.example`
- `backend/.env.example`
- `backend/package.json`
- `backend/src/utils/logDetails.ts`
- `backend/src/shared/middleware/corsHandler.ts`
- `backend/src/config/ai.ts`
- `backend/src/modules/question/services/QuestionService.ts`
- `ai/pyproject.toml`
- `ai/.env.example`

---

## 17. Validations Performed

- [x] All `.env` files properly gitignored (root, backend, frontend `.gitignore` checked)
- [x] `.env.example` files contain only placeholders — no real secrets
- [x] CORS now driven entirely by `APP_ORIGINS` env var
- [x] Two hardcoded `100.100.108.x` service URLs in backend replaced with env vars
- [x] `aiConfig` import added to `QuestionService.ts` before using `aiConfig.agentSearchUrl`
- [x] All other `100.100.108.x` occurrences in `ai/` and `mcp/` are already wrapped in `os.getenv(...)` with the hardcoded value as fallback (correct pattern)
- [x] No real API keys found hardcoded in source code (only in `.env` files which are gitignored)
- [x] Frontend title and meta updated
- [x] Backend startup banner updated
- [x] Python module imports not broken (package directory `agriseva/` unchanged)

---

## 18. Current Deployment Blockers

| # | Blocker | What's needed |
|---|---|---|
| 1 | **Firebase credentials not configured** | Firebase project + service account JSON |
| 2 | **MongoDB Atlas URI not provided** | MongoDB cluster URL (`DB_URL`) |
| 3 | **Anthropic API key missing** | `ANTHROPIC_API_KEY` |
| 4 | **MiniMax self-hosted infrastructure** | `MINIMAX_BASE_URL` + `MINIMAX_API_KEY` pointing to running MiniMax server |
| 5 | **Embedding server not configured** | `GOLDEN_EMBEDDING_ENDPOINT` pointing to running BGE embedding server |
| 6 | **`REMOTE_IP` not set** | Internal Tailscale IP of your self-hosted infrastructure node |
| 7 | **MCP servers not running** | All FastMCP services must be running and reachable |
| 8 | **Docker images not built** | Either build locally or push to Docker Hub |

---

## 19. Exact Information Needed From You Next

To proceed to Phase 2 (service configuration), I need the following from you **one at a time**:

### Step A — Firebase
1. **Firebase Project ID** (e.g., `my-project-abc123`)
2. **Firebase Web App config** (from Firebase Console > Project Settings > General > Your apps)
3. **Firebase service account JSON** (from Firebase Console > Project Settings > Service Accounts > Generate new private key)

### Step B — MongoDB
4. **MongoDB Atlas connection string** (`mongodb+srv://...`)
5. **Database name** (default: `agriai`)

### Step C — AI / LLM
6. **Anthropic API key** (`sk-ant-...`)
7. **MiniMax configuration** — is MiniMax self-hosted on Tailscale, or are you using a different cloud LLM?
8. **`REMOTE_IP`** — what is the Tailscale IP of the server hosting your MCP/LLM services?

### Step D — Optional services
9. **Sarvam AI API key** (if using voice/translation)
10. **Plivo credentials** (if using voice calling)
11. **Are you deploying to Docker/VPS, or Firebase Hosting?**
    - If Docker: what is the server IP/domain?
    - If Firebase Hosting: do you want to keep the existing Firebase Hosting sites (`agriseva-prod`) or create new ones?

> ⚠️ **Do NOT share actual secrets in chat**. Share only the format or source of each credential. Secrets should go directly into your `.env` file.
