# AgriSeva-AI — Deployment Setup Guide

## Project Architecture Summary

AgriSeva-AI is a three-tier full-stack agricultural advisory platform:

```
┌─────────────────────────────────────────────────────────────────┐
│  Farmer / Reviewer (Browser / WhatsApp / Plivo voice call)      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│  Frontend  (Vite + React + TypeScript)                          │
│  Auth: Firebase (client SDK)                                    │
│  Port: 5173 (dev) / 80 (Docker nginx)                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API (VITE_API_BASE_URL)
┌──────────────────────────────▼──────────────────────────────────┐
│  Backend   (Node.js + Express + TypeScript, routing-controllers)│
│  Auth: Firebase Admin SDK (JWT validation)                      │
│  DB: MongoDB Atlas (primary data store)                         │
│  Port: 3141 (dev) / 4000 (Docker)                              │
│  Integrations: Plivo, Sarvam AI, Firebase, GCS, Sentry        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (internal / Tailscale)
┌──────────────────────────────▼──────────────────────────────────┐
│  AI Agent  (Python + LangGraph + FastAPI)                       │
│  LLM: Claude (Anthropic) + MiniMax (self-hosted)               │
│  RAG: MongoDB Atlas Vector Search + self-hosted embedding       │
│  MCP: Multiple FastMCP servers (weather, market, soil, etc.)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vite 6 + React 19 + TypeScript + TailwindCSS 4 |
| Backend | Node.js + Express 5 + TypeScript + InversifyJS |
| AI Agent | Python 3.10+ + LangGraph + FastAPI + Anthropic SDK |
| Primary DB | MongoDB Atlas (NoSQL) |
| Auth | Firebase Auth (Google + Email) |
| Storage | Google Cloud Storage (GCS) |
| Voice | Plivo (WebSocket streaming) |
| Translation | Sarvam AI API |
| LLM | Claude Sonnet/Haiku (Anthropic) + MiniMax (self-hosted) |
| Embeddings | BAAI/bge-large-en-v1.5 (self-hosted endpoint) |
| Vector Search | MongoDB Atlas Vector Search |
| Observability | Sentry |

---

## Environment Variable Reference

### PUBLIC (frontend — safe to expose via VITE_*)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (e.g. `/api` or `https://api.yourdomain.com/api`) |
| `VITE_ENABLE_MOCKS` | Enable MSW mocks for development (set `false` in production) |
| `VITE_FIREBASE_API_KEY` | Firebase web app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID (optional) |
| `VITE_SARVAM_API_KEY` | Sarvam AI key (used in browser for STT/TTS) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for web push notifications |
| `VITE_PLIVO_*` | Plivo endpoint credentials for browser SDK |

### PRIVATE (backend — never expose)

| Variable | Description | Required |
|---|---|---|
| `DB_URL` | MongoDB Atlas connection string (`mongodb+srv://...`) | ✅ Yes |
| `DB_NAME` | MongoDB database name (default: `agriai`) | ✅ Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID (Admin SDK) | ✅ Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | ✅ Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | ✅ Yes |
| `FIREBASE_API_KEY` | Firebase server-side API key | ✅ Yes |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Optional |
| `ADMIN_PASSWORD` | Initial admin user password | ✅ Yes |
| `INTERNAL_API_KEY` | Service-to-service auth key | ✅ Yes |
| `SARVAM_API_KEY` | Sarvam AI (backend STT/TTS) | Optional |
| `PLIVO_AUTH_ID` | Plivo auth ID | Optional |
| `PLIVO_AUTH_TOKEN` | Plivo auth token | Optional |
| `PLIVO_NUMBER` | Plivo phone number | Optional |
| `PLIVO_STREAM_URL` | Plivo WebSocket stream URL | Optional |
| `VAPID_PUBLIC_KEY` | VAPID public key | Optional |
| `VAPID_PRIVATE_KEY` | VAPID private key | Optional |
| `VAPID_EMAIL` | VAPID email | Optional |
| `SMTP_USER` | SMTP email user | Optional |
| `SMTP_PASS` | SMTP email password | Optional |
| `SENTRY_DSN` | Sentry DSN for error tracking | Optional |
| `AGENT_SEARCH_URL` | Agent search service URL | Optional |
| `LANGRAPH_SERVER_IP` + `LANGRAPH_SERVER_PORT` | LangGraph server | Optional |
| `GEMMA_API` + `GEMMA_API_KEY` | Gemma model endpoint | Optional |
| `GCP_BACKUP_BUCKET` | GCS bucket for DB backups | Optional |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCS service account JSON | Optional |
| `LGD_API_KEY` | data.gov.in API key for LGD | Optional |
| `WA_WEBHOOK_API_KEY` | WhatsApp webhook auth key | Optional |
| `WA_WEBHOOK_API_URL` | WhatsApp webhook endpoint | Optional |
| `REVIEW_SYSTEM_AUTH_KEY` | Review system bearer token | Optional |
| `DATA_RELEASE_URL` | Data release service endpoint | Optional |

### PRIVATE (AI agent — backend only)

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | ✅ Yes |
| `MINIMAX_API_KEY` | MiniMax API key | ✅ Yes |
| `MINIMAX_BASE_URL` | MiniMax OpenAI-compatible endpoint | ✅ Yes |
| `GOLDEN_MONGODB_URI` | MongoDB URI for Golden Dataset | ✅ Yes |
| `GOLDEN_EMBEDDING_ENDPOINT` | Self-hosted embedding server URL | ✅ Yes |
| `REMOTE_IP` | Internal Tailscale IP of MCP server node | ✅ Yes |
| `OPENWEATHER_API_KEY` | OpenWeather API key | Optional |
| `DATABASE_URL` | PostgreSQL URL for LangGraph checkpoints | Optional |
| `LGD_API_KEY` | data.gov.in API key | Optional |

---

## Local Setup

### Prerequisites
- Node.js >= 18, pnpm >= 10.4.1
- Python >= 3.10, uv
- MongoDB Atlas account (or local MongoDB)
- Firebase project

### Backend (Node.js)

```bash
cd backend
cp .env.example .env
# Fill in .env values
pnpm install
pnpm run dev
```

Backend starts at `http://localhost:3141` by default.

### Frontend (Vite + React)

```bash
cd frontend
cp .env.example .env
# Fill in .env values
pnpm install
pnpm run dev
```

Frontend starts at `http://localhost:5173` by default.

### AI Agent (Python)

```bash
cd ai
cp .env.example .env
# Fill in .env values
uv sync
uv run python -m agriseva.agents.agriseva
# Or with LangGraph CLI:
uv run langgraph dev
```

AI agent starts at `http://localhost:2024` by default (LangGraph dev server).

---

## Docker Deployment

### Build locally

```bash
cp .env.example .env
# Fill in all variables
docker compose -f docker-compose.app.yml up --build
```

### Pull from Docker Hub (Portainer)

```bash
cp .env.example .env
# Fill in all variables
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d
```

---

## Database Requirements

| Service | Technology | Role |
|---|---|---|
| Primary DB | MongoDB Atlas | Questions, answers, users, reviews |
| Analytics DB | MongoDB Atlas (separate cluster) | Analytics and reporting |
| WhatsApp DB | MongoDB Atlas (separate collection) | WhatsApp thread logs |
| LangGraph Store | PostgreSQL (asyncpg) | LangGraph checkpoint store |
| Vector Search | MongoDB Atlas Vector Search | Semantic question retrieval |

---

## Firebase Configuration

Firebase is used for:
1. **Firebase Auth** — user authentication (Google OAuth + email/password)
2. **Firebase Hosting** — frontend static file hosting (production/staging)
3. **Firebase Admin SDK** — server-side JWT verification

### What you need from Firebase Console

1. Go to **Firebase Console** → your project
2. **Project Settings** → **General** → **Your apps** → web app → config object
   - Gives: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
3. **Project Settings** → **Service Accounts** → **Generate new private key**
   - Gives: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`

> **Important**: The Firebase project ID is currently `vibe-5b35a` (existing project).
> Firebase Hosting sites are `agriseva-prod` and `agriseva-staging-594`.
> These site names are registered in Firebase and **cannot be changed without creating new Hosting sites**.

---

## External Services Required

| Service | Purpose | Where to get |
|---|---|---|
| Firebase | Auth + Hosting | console.firebase.google.com |
| MongoDB Atlas | Primary database + vector search | cloud.mongodb.com |
| Anthropic | Claude LLM (translation, follow-up) | console.anthropic.com |
| Sarvam AI | Speech-to-text, translation | app.sarvam.ai |
| Plivo | Voice calling WebSocket | console.plivo.com |
| Sentry (optional) | Error tracking | sentry.io |
| GCS (optional) | File storage, DB backups | console.cloud.google.com |
| data.gov.in (optional) | LGD location data | data.gov.in |
| OpenWeather (optional) | Weather data | openweathermap.org |

### Self-hosted services (internal Tailscale network)

These run on your own infrastructure and are accessed via Tailscale:

| Service | Default Port | Purpose |
|---|---|---|
| MiniMax LLM | 8001 | Primary reasoning LLM |
| Gemma LLM | 8013 / 8014 | Weather, market agents |
| Embedding server | 6001 | BGE-large embeddings |
| Agent search | 6002 | Semantic question search |
| Golden API | 8110 | RAG golden dataset API |
| LangGraph server | 9017 | AI agent runtime |
| IMD weather wrapper | 18080 | Indian weather data |
| MCP servers | 9000-9101 | Tool endpoints |

---

## Production Deployment Prerequisites

Before deploying to production:

1. ✅ MongoDB Atlas cluster provisioned with vector search index
2. ✅ Firebase project created and configured
3. ✅ Anthropic API key provisioned
4. ✅ Sarvam AI API key provisioned
5. ✅ All self-hosted infrastructure running on Tailscale network
6. ✅ `.env` file filled with all required values
7. ✅ GCP service account JSON for storage/backup (if using)
8. ✅ VAPID keys generated: `npx web-push generate-vapid-keys`
9. ✅ `ADMIN_PASSWORD` set to a strong password
10. ✅ `INTERNAL_API_KEY` set to a random 32-byte hex: `openssl rand -hex 32`
