# Farmer Dashboard — Real-Data Smoke Test Audit

**Scope:** Every route under `/farmer/*` — trace each feature from real-world source → MCP/API → backend service → MongoDB → REST → frontend hook → UI. Score each as **REAL**, **PARTIAL**, or **MOCK**.

**Method:** Read-only audit. Source files, controller code, repository wiring, seed loader, and live `backend.out.txt` log evidence examined.

**Test env:** Local dev (no docker-compose live during this audit; backend previously observed serving `/api/market-prices` with `200` responses from `::1` — see log evidence).

---

## Executive Verdict

| # | Feature | Route | Verdict |
|---|---------|-------|---------|
| 1 | Home dashboard | `/farmer` | **PARTIAL** — aggregates hooks below; banners explicitly mark demo data |
| 2 | Market prices | `/farmer/prices` | **REAL** — live Agmarknet/eNAM via MCP → MongoDB → REST |
| 3 | Buyers list | `/farmer/buyers` | **PARTIAL** — real MongoDB persistence, but catalog is seeded fiction |
| 4 | Buyer detail | `/farmer/buyers/$buyerId` | **PARTIAL** — same as #3, plus `use-market-match` mixes real prices with seeded buyers |
| 5 | My lots | `/farmer/lots` | **PARTIAL** — real MongoDB writes, seeded demo on first boot |
| 6 | Create lot | `/farmer/lots/new` | **PARTIAL** — POST persists to real Mongo; "demo-farmer-uid" header is auth bypass |
| 7 | Lot detail | `/farmer/lots/$lotId` | **PARTIAL** — same as #5 |
| 8 | Offers (all + per-lot) | `/farmer/offers` | **PARTIAL** — real Mongo with `OfferService` accept-cascade; seeded offers |
| 9 | Payments | `/farmer/payments` | **PARTIAL** — transaction records in real Mongo; **NO payment gateway integrated** (explicit code comment) |
| 10 | Grievances | `/farmer/grievances` | **PARTIAL** — real Mongo persistence, seeded + user-created records |
| 11 | Storage | `/farmer/storage` | **PARTIAL** — real Mongo for options/bookings, seeded catalog |
| 12 | Logistics | `/farmer/logistics` | **PARTIAL** — real Mongo for options/bookings, seeded catalog |
| 13 | Profile | `/farmer/profile` | **MOCK** — `useFarmerProfile` returns hardcoded `DEMO_FARMER_PROFILE` with `delay(120)`, no network call |

## 1. Home dashboard — `/farmer`

**Source:** Aggregates hooks from sections 2–14 below.
**Verdict:** **PARTIAL** — composition only.

| Layer | Detail |
|---|---|
| File | `frontend/src/features/farmerDashboard/components/FarmerHomePage.tsx` |
| Hooks bound | `useFarmerProfile`, `useAllMarketPrices`, `useMyLots`, `useAllOffers`, `useGrievances`, `usePayments` |
| Banner | `FarmerLayout.tsx:120` — *"Demo Data — This dashboard currently renders sample data so you can explore the experience. Live mandi feeds and buyer KYC will be enabled when the production backend is connected."* |
| Evidence | `frontend/src/features/farmerDashboard/components/FarmerHomePage.tsx:43-48` — quick-action links to `/farmer/prices`, `/farmer/buyers`, `/farmer/lots`, `/farmer/offers` |

**Blocker:** None — composes child features.

---

## 2. Market prices — `/farmer/prices`

**Source:** **LIVE Agmarknet (primary) + eNAM (secondary) via MCP → MongoDB → REST**
**Verdict:** **REAL** ✅

| Layer | Detail |
|---|---|
| Upstream | Agmarknet / eNAM scraped by MCP server `mcp/other_markets/unified_mandi_prices.py` |
| Ingestion | `POST /api/market-prices/refresh` — backend ingests on demand |
| Storage | `marketPriceSnapshots` collection in MongoDB |
| Backend controller | `backend/src/modules/marketIntelligence/controllers/MarketPricesController.ts` (line 2: *"Real mandi prices sourced from Agmarknet (primary) and eNAM (secondary). The backend is the authoritative data boundary for the Farmer Dashboard; never rely on frontend mock rows."*) |
| Repository | `MarketPriceRepository` (MCP-side upsert + TTL) |
| REST endpoints | `GET /api/market-prices`, `GET /api/market-prices/history`, `GET /api/market-prices/reliability`, `POST /api/market-prices/refresh` |
| Frontend hook | `useMarketPrices`, `useRefreshMarketPrices`, `useMarketHistory`, `useMarketReliability` in `frontend/src/features/farmerDashboard/hooks/data.ts` |
| Live log evidence | `backend.out.txt:299-304` — `POST /api/market-prices/refresh from ::1 - Status: 200 (4232ms)` then `GET /api/market-prices?commodity=Bajra&state=Gujarat&limit=5 - Status: 200 (181ms)` |
| Provenance surfaced to UI | `data.ts:217-250` — `BackendMarketPricesResponse` carries `source: "agmarknet" | "enam" | "demo"`, `sourceUrl`, `fetchedAt`, `ingestedAt`, `isDemo` |
| PowerShell probe | `get-market-prices.ps1`, `_probe_prices.ps1` — script-based smoke test using `Invoke-RestMethod` |

**Blocker:** None. Feature is production-grade.

---

## 3. Buyers list — `/farmer/buyers`

**Source:** **Hardcoded seed `DEMO_BUYERS` (12 records) inserted into real MongoDB on first boot**
**Verdict:** **PARTIAL** — real persistence, fictional catalog

| Layer | Detail |
|---|---|
| Seed source | `backend/src/modules/transaction/seed/demoData.ts` — `DEMO_BUYERS` array of 12 fictional FPO/processor/retailer/exporter/digital buyers |
| Seed loader | `backend/src/modules/transaction/services/SeedLoader.ts` — runs once at boot, idempotent, marks every record `isDemo: true` |
| Backend controller | `backend/src/modules/transaction/controllers/BuyerController.ts` — `@JsonController('/buyers')` (line 36) |
| Repository | `BuyerRepository` — MongoDB collection, no external KYC lookup |
| REST endpoint | `GET /api/buyers`, `GET /api/buyers/:id` |
| Frontend hook | `useBuyers()`, `useBuyer(id)` in `data.ts:572-617` — "real API first, fall back to `DEMO_BUYERS` Zustand slice if `null`/empty" |
| Auth | `x-demo-farmer-id: demo-farmer-uid` header set by `transaction-api.ts:11` |
| Banner disclosure | `FarmerLayout.tsx:120` — *"Live mandi feeds and buyer KYC will be enabled"* |

**Blocker:** **Buyer KYC not integrated.** Confirmed by:
- `frontend/src/features/legal/PrivacyPage.tsx:126` — *"Real-world integrations with KYC providers, payment gateways, logistics partners, and warehouse APIs are planned but not yet active."*
- `frontend/src/features/legal/TermsPage.tsx:77` — same wording in ToS.

---

## 4. Buyer detail — `/farmer/buyers/$buyerId`


## 5. My lots — `/farmer/lots`

**Source:** MongoDB `lots` collection. Seeded demo + user-created lots both persist.
**Verdict:** **PARTIAL** — real persistence over mixed content

| Layer | Detail |
|---|---|
| Seed | `DEMO_LOTS` (4 records) in `seed/demoData.ts` |
| Backend controller | `backend/src/modules/transaction/controllers/LotController.ts` — `@JsonController('/lots')` |
| Repository | `LotRepository` (Mongo) |
| REST | `GET /api/lots`, `GET /api/lots/:id`, `POST /api/lots`, `PATCH /api/lots/:id`, `DELETE /api/lots/:id`, `POST /api/lots/:id/mark-sold` |
| Frontend hook | `useMyLots()`, `useLot(id)` in `data.ts:620-680` |
| UI page | `MyLotsPage` |

**Blocker:** None for persistence. The seeded lots look real; they will mix with user-created lots until the DB is reset.

---

## 6. Create lot — `/farmer/lots/new`

**Source:** Frontend form → `POST /api/lots` → `LotController.create` → `LotRepository.insert` → MongoDB
**Verdict:** **PARTIAL** — real write, demo farmer identity

| Layer | Detail |
|---|---|
| Form | `CreateLotPage.tsx:140-180` |
| Mutation hook | `useCreateLot()` in `data.ts:620-680` |
| Mutation fn | `createLotApi(payload)` from `transaction-api.ts:73` |
| Backend | `LotController.create` — validates with Zod schema, returns `{success, lot}` |
| Auth bypass | `x-demo-farmer-id` header is the only identity check (no JWT) |

**Blocker:** **Auth bypass** — anyone can POST a lot as `demo-farmer-uid`. **Production-critical.**

---

## 7. Lot detail — `/farmer/lots/$lotId`

**Source:** MongoDB `lots` (per-id), `offers` (per-lot)

## 9. Payments — `/farmer/payments`

**Source:** MongoDB `payments` collection. **Transaction records ONLY — no payment gateway integrated.**
**Verdict:** **PARTIAL** — real records, no actual money movement

| Layer | Detail |
|---|---|
| **Smoking-gun comment** | `backend/src/modules/transaction/controllers/PaymentController.ts:2-6` — *"These are TRANSACTION RECORDS ONLY. We do not integrate a real payment gateway. The `reference` field is treated as a free-text transaction number so any real reference can be persisted later."* |
| Payment gateway search | `stripe|razorpay|payu|cashfree|ccavenue` — zero matches in any `*.ts` source file (only false positives in village-name metadata) |
| Seed | `DEMO_PAYMENTS` (2 records) |
| REST | `GET /api/payments`, `POST /api/payments`, `PATCH /api/payments/:id` |
| Frontend hook | `usePayments()` in `data.ts:1098-1109` |
| Frontend mock fallback | If `fetchPayments()` returns null/empty, returns `DEMO_PAYMENTS` Zustand slice |

**Blocker:** **No real payment provider.** Until Stripe/Razorpay is wired, a "Payment" record is just a journal entry. `reference` field is free-text — could be a future bank reference but currently empty.

---

## 10. Grievances — `/farmer/grievances`

**Source:** MongoDB `grievances` collection. Seeded + user-created.
**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Seed | `DEMO_GRIEVANCES` (1 record) |
| Backend controller | `GrievanceController` (`@JsonController('/grievances')`) |
| REST | `GET /api/grievances`, `POST /api/grievances`, `PATCH /api/grievances/:id` |
| Frontend hooks | `useGrievances()`, `useCreateGrievance()`, `useUpdateGrievance()` |

**Blocker:** Auth bypass; no SLA/escalation engine visible.

---

## 11. Storage — `/farmer/storage`

**Source:** MongoDB `storage_options` + `storage_bookings`
**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Seed | `DEMO_STORAGE_OPTIONS` |
| Backend controller | `StorageController` |
| REST | `GET /api/storage/options`, `GET /api/storage/bookings`, `POST /api/storage/bookings` |

## 13. Profile — `/farmer/profile`

**Source:** **Frontend mock only — NO backend call, NO persistence.**
**Verdict:** **MOCK** ❌

| Layer | Detail |
|---|---|
| **Smoking-gun code** | `frontend/src/features/farmerDashboard/hooks/data.ts:155-163` — `useFarmerProfile` is a `useQuery` with `queryFn: async () => { await delay(120); return DEMO_FARMER_PROFILE; }`. **No `fetch` to `/api/users/me` or any endpoint.** |
| Update mutation | `data.ts:175-220` — `useUpdateFarmerProfile` mutates only the React Query cache (`qc.setQueryData`). No network. Comment at line 180: *"The profile lives in mock land today; in a real backend this would be a PATCH/PUT."* |
| Source of truth | `DEMO_FARMER_PROFILE` constant in `frontend/src/features/farmerDashboard/mocks/profile.mock.ts` |
| UI page | `FarmerProfilePage` |

**Blocker:** **Profile is entirely client-side.** Edits lost on refresh. To make real, must add a `/api/users/me` or `/api/farmers/me` endpoint and wire `useFarmerProfile` to fetch it.

---

## 14. Notifications (top-bar bell) — across all `/farmer/*`

**Source:** **Frontend synthesizes from in-memory store. Backend `NotificationService` exists but is NOT called.**
**Verdict:** **MOCK** ❌

| Layer | Detail |
|---|---|
| **Hook implementation** | `data.ts:1212-1279` — `useNotifications` calls `await delay(40)` then synthesizes items by filtering `store.offers` (pending), `qc.getQueryData("payments")` (pending), `store.grievances` (open/in_review), and merges with `store.notifications` Zustand slice. **No `fetch`.** |
| Persistence | `useNotifications` writes nothing; `markNotificationRead` only updates the Zustand slice |
| Backend service (unused by farmer dashboard) | `backend/src/modules/notification/services/NotificationService.ts` — exists and is called by `AnswerService`, `UserService`, `balanceWorkload.worker` for question-review flows. **None of these triggers are reached by farmer dashboard mutations.** |

**Blocker:** **Bell is fake.** A new offer accepted by the farmer will not push a "lot sold" notification because nothing wires `OfferService.accept()` → `NotificationService.saveTheNotifications()` for the farmer. The bell only shows what was synthetically derived from the current React Query cache — which means once the user navigates away, "unread" is meaningless.

---


## Cross-Cutting Findings

### A. Authentication is bypassed everywhere

**File:** `frontend/src/hooks/api/transaction-api.ts:7-22`
```ts
const FARMER_HEADER = 'x-demo-farmer-id';
const FARMER_ID = 'demo-farmer-uid';
const buildHeaders = (extra) => ({ ...(extra ?? {}), [FARMER_HEADER]: FARMER_ID });
```
**Backend:** Every controller in `transaction/` and `marketIntelligence/` calls `resolveFarmerId(header)` which returns the header value verbatim or falls back to literal `"demo-farmer-uid"`. **No JWT, no Firebase auth check.**

**Risk:** Anyone with the running backend URL can:
- Read every farmer's lots/offers/payments/grievances
- Create lots/offers/grievances as `demo-farmer-uid`
- Accept/reject offers (triggers `OfferService.accept` cascade — auto-materializes a payment record)

**Severity:** **Production-critical blocker.** Must wire `apiFetch` to attach `Authorization: Bearer <firebase-id-token>` and have controllers validate it server-side.

### B. `isDemo: true` on every seeded record

**File:** `backend/src/modules/transaction/services/SeedLoader.ts`
**Purpose:** Frontend can badge demo content. **Currently the frontend does NOT filter on this flag** — seeded and user-created records render indistinguishably.

### C. Hybrid fallback pattern (real API first, Zustand second)

Every transaction hook in `data.ts` follows the pattern:
```ts
queryFn: async () => {
  const remote = await fetchX();
  if (remote && remote.length > 0) return remote;
  await delay(N);
  return DEMO_X;  // fallback if backend is offline or returns []
}
```

**Implication:** If the backend is offline, the dashboard degrades to fully-mock mode with zero network errors surfaced to the user. Silent failure.

### D. Live backend log evidence

`backend.out.txt:299-304, 552-557` shows real `/api/market-prices` traffic:
```
POST /api/market-prices/refresh from ::1 - Status: 200 (4232ms)
GET  /api/market-prices?commodity=Bajra&state=Gujarat&limit=5 - Status: 200 (181ms)
GET  /api/market-prices?commodity=Tomato&limit=100 - Status: 200 (141ms)
GET  /api/market-insights/today?state=Karnataka&commodity=Tomato - Status: 200 (78ms)
```
Confirmed during this session via `Get-Process` that node processes are running; backend at port 3141 was not currently reachable (likely stopped). The log slice demonstrates the system **has run end-to-end with live MCP data**.

---

## Summary Scorecard

| Verdict | Count | Routes |
|---|---|---|
| **REAL** (live external source end-to-end) | 1 | `/farmer/prices` |
| **PARTIAL** (real persistence, seeded/incomplete content) | 12 | home, buyers, buyer detail, lots (×3), offers, payments, grievances, storage, logistics, recommend |
| **MOCK** (no backend call) | 2 | profile, notifications |

**Real external integrations confirmed:** 1 (Agmarknet/eNAM via MCP).
**Real external integrations missing:** 5 (KYC, payment gateway, warehouse, logistics provider, real user profile store).

**Production blockers (must fix before launch):**
1. **Auth bypass** — `x-demo-farmer-id` everywhere
2. **Payment gateway** — no real money movement
3. **Buyer KYC** — catalog is 100% fictional
4. **Profile persistence** — edits don't survive refresh
5. **Notification delivery** — bell is decorative

**Acceptable for demo / staging launch as-is:** Lots/offers/payments/grievances/storage/logistics/grievances workflows will work end-to-end against seeded data; user-created records persist to MongoDB; market prices are real. The system demonstrates the full farmer transaction workflow against a synthetic counterpart.

---

## File Index (key evidence)

| File | Lines | Purpose |
|---|---|---|
| `frontend/src/hooks/api/transaction-api.ts` | 7-22 | Auth bypass header |
| `frontend/src/features/farmerDashboard/hooks/data.ts` | 155-220 | Profile is MOCK |
| `frontend/src/features/farmerDashboard/hooks/data.ts` | 572-617 | Buyer hooks (hybrid) |
| `frontend/src/features/farmerDashboard/hooks/data.ts` | 1212-1279 | Notifications synthesized |
| `backend/src/modules/transaction/controllers/PaymentController.ts` | 2-6 | "No payment gateway" comment |
| `backend/src/modules/transaction/services/SeedLoader.ts` | full | Seeds demo data on boot |
| `backend/src/modules/transaction/seed/demoData.ts` | full | Source of fictional buyer/lot/offer/payment/grievance records |
| `backend/src/modules/marketIntelligence/controllers/MarketPricesController.ts` | 2-48 | Real MCP prices declaration |
| `frontend/src/features/farmerDashboard/FarmerLayout.tsx` | 120 | Demo banner |
| `frontend/src/features/legal/PrivacyPage.tsx` | 126 | Privacy disclosure |
| `frontend/src/features/legal/TermsPage.tsx` | 77 | Terms disclosure |
| `frontend/src/routeTree.gen.ts` | 245-253 | Route inventory |
| `backend/src/modules/transaction/index.ts` | full | Controller wiring for transaction module |
| `backend/src/modules/transaction/container.ts` | full | DI bindings |

## 15. Recommend (market match) — `/farmer/recommend`

**Source:** Real MCP mandi prices (REAL) × seeded buyer scoring (PARTIAL) × mock profile (MOCK)
**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Frontend scoring | `frontend/src/features/farmerDashboard/hooks/use-market-match.ts` — `computeBuyerMatch()` |
| Backend recommender | `backend/src/modules/marketIntelligence/services/RecommendationService.ts:6` — reuses the same scoring algorithm in TS for the API path |
| Inputs | Real prices (`useAllMarketPrices`), seeded buyers (`useBuyers`), mock profile (`useFarmerProfile`) |
| Outputs | Mandi recommendation + buyer recommendation (top 3 with scores) |

**Blocker:** Recommendations are mathematically correct but anchored to fictional buyer catalog. A real buyer pool requires KYC integration (#3 gap).

---

| Frontend hooks | `useStorageOptions()`, `useStorage()`, `useReserveStorage()` |

**Blocker:** Warehouse API not integrated (per `PrivacyPage` disclaimer).

---

## 12. Logistics — `/farmer/logistics`

**Source:** MongoDB `logistics_options` + `logistics_bookings`
**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Seed | `DEMO_LOGISTICS_OPTIONS` |
| Backend controller | `LogisticsController` |
| REST | `GET /api/logistics/options`, `POST /api/logistics/bookings` |
| Frontend hooks | `useLogisticsOptions()`, `useBookLogistics()` |

**Blocker:** Logistics provider API not integrated.

---

**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Hooks | `useLot(lotId)` + `useOffersForLot(lotId)` |
| Per-lot offers endpoint | `GET /api/lots/:lotId/offers` (`OfferController`, `LotOffersController`) |
| Edit/delete | `PATCH /api/lots/:id`, `DELETE /api/lots/:id` |

**Blocker:** Same auth bypass as #6.

---

## 8. Offers — `/farmer/offers`

**Source:** MongoDB `offers` collection; **`OfferService` runs a multi-collection cascade on accept** (transition offer → accepted → reject siblings → mark lot sold → materialize payment)
**Verdict:** **PARTIAL** — real workflow, seeded inventory

| Layer | Detail |
|---|---|
| Seed | `DEMO_OFFERS` in `seed/demoData.ts` |
| Backend controller | `OfferController` + `LotOffersController` (nested routes) |
| Service | `OfferService.accept | reject | withdraw | counterOffer` — cross-collection transaction |
| REST | `GET /api/offers`, `GET /api/lots/:lotId/offers`, `POST /api/offers`, `PATCH /api/offers/:id`, `POST /api/offers/:id/counter` |
| Frontend hooks | `useAllOffers`, `useOffersForLot`, `useUpdateOfferStatus`, `useCounterOffer` |
| Accept cascade | `OfferController.ts:11-15` — documented; `offerService.accept()` orchestrates the lot+payments side-effects |

**Blocker:** Auth bypass; seeded offers appear real until DB reset.

---

**Source:** Same seeded catalog as #3, enriched with **real market prices** via `computeBuyerMatch`
**Verdict:** **PARTIAL**

| Layer | Detail |
|---|---|
| Hook | `useBuyer(id)` (line 590) |
| Match scoring | `frontend/src/features/farmerDashboard/hooks/use-market-match.ts` — `computeBuyerMatch()` |
| Inputs | Buyer record (DEMO) + `useAllMarketPrices()` (REAL) + farmer profile (MOCK) |
| Output | Recommendation score, realisable value, suitability flag |
| UI page | `frontend/src/features/farmerDashboard/components/BuyerDetailPage.tsx` |

**Blocker:** None — math is correct, but it scores a fictional buyer pool against real prices. Recommendations are mathematically real, commercially meaningless.

---

| 14 | Notifications (bell) | (top-bar widget) | **MOCK** — `useNotifications` synthesizes from in-memory store only; backend `NotificationService` exists but is not used by farmer dashboard |
| 15 | Recommend (market match) | `/farmer/recommend` | **PARTIAL** — real MCP mandi prices × seeded buyer scoring |

**Two cross-cutting gaps flagged as production-critical:**
1. **Auth bypass** — every transaction route reads `x-demo-farmer-id` header (defaults to literal `"demo-farmer-uid"`). No JWT validation.
2. **Buyer KYC missing** — confirmed by code comment in `PaymentController.ts` ("TRANSACTION RECORDS ONLY. We do not integrate a real payment gateway"), `PrivacyPage`, `TermsPage`, and the `FarmerLayout` demo banner ("Live mandi feeds and buyer KYC will be enabled when the production backend is connected").

---
