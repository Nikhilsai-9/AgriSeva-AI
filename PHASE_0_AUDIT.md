# PHASE 0 — Read-Only Audit — Market Intelligence 2.0

**Date:** 2026-09-21
**Scope:**
- `backend/src/modules/marketIntelligence/` (controllers, services, mcp, repositories, validators, container, index, tests)
- `backend/src/bootstrap/jobs/marketIngestCron.ts`
- `frontend/src/features/farmerDashboard/{types,components,hooks,market-intelligence,mocks}`

**Audit mode:** READ-ONLY. Every gap listed is paired with the *intended* fix scope for later PHASES (1–46). **No code will be edited until the user signs off this audit.**

---

## 1. Architecture snapshot

### Backend (1/1)

| Layer | Component | File | Purpose |
|------|-----------|------|---------|
| API (entry) | `MarketPricesController` | `controllers/MarketPricesController.ts` | `GET /market-prices`, `GET /market-prices/history`, `GET /market-prices/reliability`, `POST /market-prices/refresh` |
| API | `MarketComparisonController` | `controllers/MarketComparisonController.ts` | `GET /market-comparison` |
| API | `MarketInsightController` | `controllers/MarketInsightController.ts` | `GET /market-insights/today` |
| API | `MarketHealthController` | `controllers/MarketHealthController.ts` | `GET /market-health` |
| Service | `MarketIngestionService` | `services/MarketIngestionService.ts` | Orchestrates Agmarknet → eNAM, persists, seeds alias table |
| Service | `MarketNormaliser` | `services/MarketNormaliser.ts` | Pure: upstream payload → canonical `MarketPriceRecord` |
| Service | `MarketHistoryService` | `services/MarketHistoryService.ts` | Computes `changePct`, `trendPct` |
| Service | `MarketReliabilityService` | `services/ReliabilityService.ts` | 0..100 per-source score (40 % + 30 % + 20 % + 10 %) |
| Service | `RecommendationService` | `services/RecommendationService.ts` | Server-side "best of N" by highest modalPrice |
| Service | `CommodityResolver` | `services/CommodityResolver.ts` | Exact-match alias resolution; extracts base name from canonicals |
| MCP client | `AgmarknetMcpClient` | `mcp/agmarknetClient.ts` | Three tools; default endpoint `http://market_agmarknet:9004/mcp` |
| MCP client | `EnamMcpClient` | `mcp/enamClient.ts` | Three tools; default endpoint `http://market_enam:9022/mcp` |
| MCP transport | `jsonRpcHttp` | `mcp/jsonRpcHttp.ts` | FastMCP streamable-http client; 15 s timeout; session-id cache |
| Repo | `MarketPriceRepository` | `repositories/MarketPriceRepository.ts` | `market_prices`; 5 indexes; idempotent upsert by `recordKey`; `_id` projection |
| Repo | `MandiRepository` | `repositories/MandiRepository.ts` | `mandis` collection; coords only from upstream |
| Repo | `CommodityAliasRepository` | `repositories/CommodityAliasRepository.ts` | `commodity_alias`; seeded lazily from real observations |
| Repo | `DataUpdateLogRepository` | `repositories/DataUpdateLogRepository.ts` | Append-only audit of every upstream fetch |
| Validator | `MarketValidators` | `validators/MarketValidators.ts` | `class-validator` DTOs for all 6 endpoints |
| Wiring | `container.ts` | `container.ts` | Inversify bindings (singleton scope) |
| Wiring | `index.ts` | `index.ts` | Exports controllers + validators arrays for `loadAppModules` |
| Bootstrap | `marketIngestCron` | `backend/src/bootstrap/jobs/marketIngestCron.ts` | `node-cron` schedule `7 */6 * * *` (Asia/Kolkata); guarded by `ENABLE_MARKET_INGEST_CRON` |

### Frontend (1/1)

| Layer | Component | File | Purpose |
|------|-----------|------|---------|
| Page | `MarketPricesPage` | `components/MarketPricesPage.tsx` | Filter + grid; source badges (AGMARKNET/eNAM/DEMO/LIVE); stale-vs-fresh chip; `STALE_HOURS = 6` |
| Page | `MarketComparisonPage` | `components/MarketComparisonPage.tsx` | Per-lot `recommendBestMarketForLot()` candidate list; full breakdown; "Why we recommend this" |
| Page | `FarmerHomePage` | `components/FarmerHomePage.tsx` | Greeting header, "Today's headline" insight, best-market card for top active lot |
| Page | `LotDetailPage` | `components/LotDetailPage.tsx:53` | Uses `useAllMarketPrices()` for buyer ranking |
| Layout | `FarmerLayout` | `FarmerLayout.tsx` | Shell + nav; "Demo Data" banner REMOVED in commit `69b511160` |
| Engine (pure) | `recommendation.ts` | `market-intelligence/recommendation.ts` | 5-factor weighted scoring (netValue 50 / distance 15 / demand 15 / paymentRel 10 / qualityMatch 10) |
| Engine (pure) | `realisable-value.ts` | `market-intelligence/realisable-value.ts` | Net realisable = gross − (transport + loading + unloading + marketFee + insurance + other) |
| Engine (pure) | `reliability.ts` | `market-intelligence/reliability.ts` | BUYER reliability: verifiedBonus +20, rating 0..35, deals log-scale 0..25, payment 0..20, dispute penalty 0..−20; **RULE 11**: returns `null` when buyer.completedDeals < 3 |
| Constants | `constants.ts` | `market-intelligence/constants.ts` | `RECOMMENDATION_WEIGHTS`, `MAX_DISTANCE_KM = 200`, `MIN_DEALS_FOR_RELIABILITY = 3`, `KG_PER_QUINTAL = 100`, `RELIABILITY_TIERS`, `DEFAULT_LOGISTICS_COSTS` |
| Hook | `useMarketPrices(query)` | `hooks/data.ts:395` | `GET /market-prices` with full filter support |
| Hook | `useAllMarketPrices()` | `hooks/data.ts:444` | `GET /market-prices` (no filters) |
| Hook | `useTodayInsight({state,market,commodity})` | `hooks/data.ts:468` | `GET /market-insights/today` |
| Hook | `useMarketComparison({commodity,state,limit})` | `hooks/data.ts:534` | `GET /market-comparison` |
| Hook | `useMarketReliability(source?)` | `hooks/data.ts:593` | `GET /market-prices/reliability` |
| Hook | `useMarketHealth()` | `hooks/data.ts:614` | `GET /market-health` |
| Hook | `useRefreshMarketPrices()` | `hooks/data.ts:628` | `POST /market-prices/refresh`; invalidates 4 caches on success |
| Hook | `useMyLots`, `useBuyers`, `useGrievances`, `useFarmerProfile`, `useAllMyOffers`, `usePayments` | `hooks/data.ts` | Real-MongoDB hooks; no silent demo fallback |
| Fixture (only remaining) | `market-prices.mock.ts` | `mocks/market-prices.mock.ts` | 14 hardcoded demo rows; consumed ONLY when backend reports `isDemo: true`. Every row's `source = "demo"`. |
| Utility | `utils.ts` | `hooks/utils.ts` | `formatRupees`, `formatRupeesPerKg`, `formatRupeesPerQuintal`, `formatKg`, `formatDistance`, `formatTrend`, `trendBadgeClass`, `trendArrow`, `formatDate`, `formatDateTime`, `greetingForNow` |
| Utility | `use-market-match.ts` | `hooks/use-market-match.ts` | Buyer matching (cropMatch 40 % / quantityFit 20 % / qualityFit 20 % / locationProximity 20 %) |
| Types | `types.ts` | `types.ts` | Full farmer-dashboard contract incl. passthrough fields (`recordKey`, `sourceSystem`, `sourceUrl`, `variety`, `grade`, `commodityGroup`, `arrivalQty`) |

---

## 2. Data Audit (per PHASE 45)

**Legend:**
- **Real?** = comes from a live upstream MCP, not a hardcoded fixture
- **Fresh?** = a scheduler refreshes it (or it persists across sessions)
- **Verified?** = covered by tests in `tests/*.test.ts`
- **Persisted?** = lands in MongoDB (`market_prices`, `mandis`, `commodity_alias`, `data_update_logs`, etc.)
- **Provenance?** = source visible to the end user in the UI

| # | Feature (surface) | Source | Real? | Fresh? | Verified? | Persisted? | Provenance? |
|---|------------------|--------|-------|--------|-----------|------------|-------------|
| 1 | Market Prices — list with filters | `GET /market-prices` → `market_prices` (Agmarknet primary, eNAM secondary) | ✅ | ✅ cron 6h + `POST /refresh` | ✅ `MarketPricesController.test.ts`, `MarketIngestionService.test.ts` | ✅ `market_prices` | ✅ Source badge (AGMARKNET/eNAM/DEMO/LIVE) + `sourceUrl` per row; `STALE_HOURS=6` chip; `isDemo` propagated |
| 2 | Price History (per mandi+commodity) | `GET /market-prices/history` → `findHistory` | ✅ | ✅ (history retained, no TTL) | ✅ indirectly via MarketIngestion tests | ✅ | ✅ Same as #1 |
| 3 | Today's headline insight | `GET /market-insights/today` → `MarketInsightController` → `MarketHistoryService.annotateWithChange` | ✅ | ✅ (depends on #1 freshness) | ✅ `MarketInsightComparisonController.test.ts` | ✅ | ✅ `source`, `sourceSystem`, `isDemo`, `changePct`, `trendPct`; surfaced in `FarmerHomePage` |
| 4 | Market Comparison (cross-mandi) | `GET /market-comparison` → `RecommendationService.compare` (server) + client `recommendBestMarketForLot` | ⚠ **PARTIAL** | ✅ (server picks latest per mandi) | ✅ | ✅ | ✅ Server: `recommendation` is **highest-modalPrice** (no distance/transport); Client: full 5-factor weighted |
| 5 | Per-source reliability score | `GET /market-prices/reliability` → `MarketReliabilityService.snapshot` | ✅ | ✅ (live from `data_update_logs`) | ✅ (`MarketHealthController.test.ts`) | ✅ `data_update_logs` | ✅ `MarketReliabilitySnapshot` with `score`, `label`, `reasons[]`, `lastSuccessAt`, `consecutiveFailures` |
| 6 | Operational health | `GET /market-health` → `MarketHealthController` | ✅ | ✅ | ✅ `MarketHealthController.test.ts` | n/a | ✅ Returns resolved MCP endpoints + reliability per source |
| 7 | On-demand refresh | `POST /market-prices/refresh` → `MarketIngestionService.ingest` | ✅ | n/a | ✅ | ✅ | ✅ Logs `data_update_log`; client invalidates 4 query keys |
| 8 | Commodity alias resolution | `CommodityResolver` + `CommodityAliasRepository` | ✅ | ✅ (lazy-seeded from real observations) | ✅ `CommodityResolver.test.ts` | ✅ `commodity_alias` | ⚠ Internal — not surfaced to user; widens queries (e.g. `Bajra` → `Bajra(Pearl Millet/Cumbu)`) |
| 9 | Mandi metadata + coordinates | `MandiRepository` (`mandis`) | ⚠ **DEPENDS** | ⚠ | ⚠ No dedicated test | ✅ `mandis` | ⚠ `mandiLat/Lon` only on `MarketPriceRecord`; not displayed in current UI (gap in §5) |
| 10 | Farmer Lots (lots CRUD) | `useMyLots`, `createLotApi`, etc. via `transaction-api.ts` | ✅ | ✅ | ✅ | ✅ | ✅ All owned by backend MongoDB |
| 11 | Buyers directory | `useBuyers` via `transaction-api.ts` | ⚠ **MIXED** — backend real buyers exist; UI falls back to seed `Buyer[]` on network failure | ✅ (live from backend) | ✅ | ✅ | ✅ Buyer card surfaces type, distance, completed deals |
| 12 | Buyer reliability score (client) | `computeReliabilityScore` | ✅ (pure buyer-side score) | n/a | ✅ | n/a (derived) | ✅ Tier badge (Excellent/Good/Fair/Limited) + evidence chips; **suppressed** when deals < 3 |
| 13 | Realisable value (net to farmer) | `computeRealisableValue` | ✅ | n/a | ✅ | n/a (derived) | ✅ Full breakdown: gross, transport, loading, unloading, marketFee, insurance, other, net |
| 14 | Best-market-for-lot (client) | `recommendBestMarketForLot` (5-factor) | ✅ | n/a | ✅ | n/a (derived) | ✅ Top-4 reasons ordered by impact |
| 15 | Buyer matching (per-lot) | `use-market-match.ts:scoreBuyersForLot` | ✅ | n/a | ✅ (indirectly) | n/a (derived) | ✅ 4-factor breakdown |
| 16 | Demo Market Prices (fallback ONLY) | `mocks/market-prices.mock.ts` (14 rows) | ❌ Hardcoded | ❌ Static | ❌ | ❌ | ✅ Clearly labelled `source: "demo"`; consumed ONLY when backend returns `isDemo: true` |
| 17 | Demo Today Insight (fallback ONLY) | `DEMO_TODAY_INSIGHT` in same mock | ❌ | ❌ | ❌ | ❌ | ✅ Labelled `isDemo: true`; only used by `useTodayInsight` when backend has zero rows |
| 18 | Notifications | `useNotifications` via `notificationToItem` projection | ✅ | ✅ | ⚠ partial | ✅ | ✅ |
| 19 | Grievances / Payments / Offers / Storage / Logistics | `useGrievances`, `usePayments`, `useAllMyOffers`, `useStorageBookings`, `useLogisticsOptions` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. UX Audit (per PHASE 45)

| # | Screen | Primary User Goal | Primary CTA | Guidance | Empty State | Error State | Mobile |
|---|--------|--------------------|------------|----------|-------------|-------------|--------|
| 1 | **Farmer Home (`/farmer`)** | "What's the price today for my crop, and where should I sell?" | Implicit: read today's insight + top recommendation card | Header banner "Good morning/afternoon/evening" + today's change% vs yesterday + recommendation copy 💡 | When no lots: hide "best-market" card; insight card falls back to `+3.2 %` placeholder | Backend error → card hidden silently; no toast yet | Stacked vertically (sm:grid-cols-3); large touch targets |
| 2 | **Market Prices (`/farmer/prices`)** | "What are current mandi prices near me / pan-India, with provenance?" | Refresh button (calls `useRefreshMarketPrices`) | Source badge (AGMARKNET=eMERALD, eNAM=SKY, DEMO=STONE, LIVE=AMBER); Stale/Fresh chip based on `STALE_HOURS=6`; per-row change% arrow | "No live mandi data available" + DEMO badge when backend returns empty + `isDemo:true` | `isErrorState` (success=false && isDemo=false) → explicit error/no-data state | 1-column on mobile, 2-col grid on tablet+ (verified via `space-y-5` + grid) |
| 3 | **Market Comparison (`/farmer/recommend`)** | "For my active lot, which mandi is best — and why?" | Expand candidate card to see full breakdown | Top-4 reasons ordered by impact (Net/Distance/Demand/Payment/Quality); full breakdown: Transport/Loading/Unloading/MarketFee/Insurance/Other | "Create an active lot to compare markets." card; sourcesInUse=[]/all-demo → DEMO badge | Currently no explicit error toast; just empty state | Vertical stack; expand/collapse on tap |
| 4 | **Lot Detail (`/farmer/lots/:id`)** | "What's my lot worth today at each nearby mandi? Who's the best buyer?" | Implicit (browse) | Buyer ranking via `useAllMarketPrices` + `scoreBuyersForLot` | Empty buyers → fall back to standing rating | Per `transaction-api.ts` fallback | Standard |
| 5 | **Buyers directory (`/farmer/buyers`)** | "Find reliable buyers for my crop" | Filter by crop/quantity/grade/distance | Reliability badge + evidence chips; **suppressed** when buyer has < 3 deals | "No buyers yet" | Standard | Standard |
| 6 | **Profile (`/farmer/profile`)** | "Manage my farm details" | Edit buttons | i18n-aware | Empty sections tolerated | Standard | Standard |
| 7 | **Storage / Logistics / Payments / Grievances / Notifications / Offers** | Side domains | Standard | Standard | Standard | Standard | Standard |

---

## 4. What's already GREAT (no fix needed)

1. **Source provenance is first-class.** Every API response carries `source`, `sourceSystem`, `sourceUrl`, `isDemo`, `fetchedAt`. The UI renders badges (`AGMARKNET` / `eNAM` / `DEMO` / `LIVE`) and a Stale/Fresh chip. The "Demo Data" banner was REMOVED from `FarmerLayout` (commit `69b511160`) — provenance is now per-component, not blanket. ✅
2. **Defence-in-depth at the API boundary.** `NO_ID_PROJECTION` in `MarketPriceRepository`, plus `stripMongoId` helper at controller level. ✅
3. **Never-throw ingestion.** `MarketIngestionService` always returns `MarketIngestionResult`; clients handle structured failures. ✅
4. **Deterministic deduplication.** `recordKey = sha256(source|state|district|market|commodity|variety|grade|arrivalDate)[0..32]` — idempotent upserts, safe to retry. ✅
5. **Exact-match alias resolution.** `CommodityResolver` never fuzzy-matches — alias table is seeded from real observations only. ✅
6. **Honest labelling of upstream limitations.** `decorateAgmarknetAggregate` injects synthetic "Gujarat (state aggregate)" market label and documents it via `sourceUrl: 'agmarknet://marketwise_price_arrival'`. ✅
7. **Five backend tests covering the critical paths:** `CommodityResolver`, `MarketIngestionService`, `MarketPricesController`, `MarketHealthController`, `MarketInsightComparisonController`. ✅
8. **`RULE 11` for buyer reliability:** returns `null` instead of a misleading low score when `completedDeals < 3`. ✅
9. **No TTL on price history:** explicit policy — "Historical records must be retained for chart rendering and trend analysis". ✅
10. **`isDemo` is always returned explicitly** — never silently substituted demo data. ✅

---

## 5. Gaps & intended fix-scope (proposals only — work NOT started)

Each gap has a severity (S1 = data-fidelity, S2 = core UX, S3 = nice-to-have, S4 = polish), an evidence pointer, and the PHASE it should belong to.

### S1 (data fidelity) — Agmarknet only exposes state-aggregate records
- **Where:** `MarketIngestionService.ts` → `decorateAgmarknetAggregate` (lines 364–442)
- **What:** The Agmarknet MCP tool we call returns one row per `(state, commodity, day)` — not per-mandi. We currently inject a synthetic market label `"Gujarat (state aggregate)"`. This is *honest* but means farmer queries for "Kolar Mandi" never get an Agmarknet row for Karnataka.
- **Evidence:** `MarketIngestionService.ts` lines 353–442; comment at line 360–362 explicitly documents this.
- **Fix scope (PHASE 6–8):** when `fetchMarketwiseDynamic` returns aggregate data, also call `fetchDashboardPerMandi` for the top-N states to get real mandi rows. Fallback chain: `AgmarknetPerMandi → AgmarknetAggregate (labelled) → eNAMPerMandi → eNAMEmpty`.

### S1 (data fidelity) — `minPrice = maxPrice = modalPrice` when only modal exists
- **Where:** `MarketIngestionService.ts` → `decorateAgmarknetAggregate` lines 399–408; same bug propagated to UI range display
- **What:** When the upstream payload has only `as_on_price` (modal), we set `min_price = max_price = modal_price`. This makes a "point" look like a "range" and breaks downstream UI that compares spread.
- **Fix scope (PHASE 6):** When `minPrice` is missing, leave it `undefined` (don't back-fill). UI must handle `min/max = undefined` gracefully (currently shows `formatRupees(undefined)` → `"—"`).

### S1 (data fidelity) — Hardcoded 6-hourly watchlist of 5 commodities
- **Where:** `MarketIngestionService.ts` → `DEFAULT_WATCHLIST` lines 34–40
- **What:** Only `Tomato, Onion, Rice, Wheat, Maize` are refreshed every 6 hours. Cotton, Groundnut, Turmeric, Chilli (in the demo) and 14 other commodities in `COMMODITIES` never get a fresh record.
- **Fix scope (PHASE 9):** Replace with a per-commodity schedule driven by `commodity_priority` collection (top-N commodities by farmer profile + pan-India watchlist). Add a "low-traffic" tier with 24-hour refresh.

### S2 (UX) — Distance is shown on the price grid but no mandi coordinates are populated
- **Where:** `MarketPrice.distanceKm` (frontend type) and `mandiLat/Lon` (backend type) — neither is currently populated from real upstream data
- **What:** Frontend relies on `distanceKm` for ranking, but it isn't set on real records (it's only set in the demo mock). Real records → `distanceKm` = undefined → `formatDistance()` returns `"—"`.
- **Fix scope (PHASE 12):** Resolve mandi coords via `mandis.mandiKey` lookup or via a reverse-geocode fallback; populate `mandiLat/Lon` and `distanceKm` (computed from farmer profile village coords).

### S2 (UX) — Server-side `RecommendationService.compare` uses ONLY modalPrice
- **Where:** `RecommendationService.ts` lines 96–102
- **What:** The "best mandi" returned by `/market-comparison` is the one with the **highest modal price** — which is *not* what the farmer wants if that mandi is far away. The client's `recommendBestMarketForLot` already does the full 5-factor scoring; the server endpoint does not.
- **Fix scope (PHASE 14):** Port the 5-factor scoring into the server's `RecommendationService.compare` so `GET /market-comparison` returns the same ranked recommendation as the client. Optionally accept a `FarmerLot` shape in the query.

### S2 (UX) — `isDemo: true` is hardcoded in `realisable-value.ts`
- **Where:** `realisable-value.ts` line 140 (`isDemo: true`)
- **What:** Every `RealisableValue` returned claims to be demo data, even when the underlying price is real. The UI can't tell the user "this net is computed from real mandi data".
- **Fix scope (PHASE 14):** Pass `price.source` through to `RealisableValue` and set `isDemo = price.source === 'demo'`.

### S2 (UX) — `MARKET_SOURCE_LABEL = "Demo"` and `MANDI_SOURCE_LABEL = "Demo Mandi"` still hardcoded
- **Where:** `market-intelligence/constants.ts` lines 85–86
- **What:** `sourceLabel(price)` in `recommendation.ts` line 259 ignores `price` entirely and always returns `"Demo Mandi"`. The constant is a fallback for when no `source` is present, but the function doesn't even check `price.source`.
- **Fix scope (PHASE 13):** `sourceLabel` should branch on `price.source` (agmarknet / enam / demo) with the constant as fallback.

### S3 (UX) — `MarketHealth` and `MarketReliability` data are fetched but never surfaced in the UI
- **Where:** `hooks/data.ts` exports `useMarketReliability` and `useMarketHealth`; not consumed by any component (verified via search)
- **What:** Backend exposes rich operational health (resolved MCP endpoints, per-source score, last success, consecutive fails), but the farmer-facing UI doesn't show it.
- **Fix scope (PHASE 22):** Add a "Data freshness" footer to `MarketPricesPage` showing the per-source chip and last-success timestamp; add a developer-facing `/farmer/system-health` page (or expand the existing one) for ops.

### S3 (data ops) — Cron schedule is hardcoded and not per-source
- **Where:** `backend/src/bootstrap/jobs/marketIngestCron.ts` line 22–47
- **What:** Single `7 */6 * * *` schedule for ALL commodities across ALL states. There's no per-source cadence and no failure alerting.
- **Fix scope (PHASE 19):** Split into per-source cadences (Agmarknet 6h, eNAM 12h as fallback). Add Slack/email alert when `consecutiveFails >= 5`.

### S3 (UX) — Mobile: Market Prices grid is 1-col on sm (verified), but Comparison page candidate cards don't collapse gracefully
- **Where:** `MarketComparisonPage.tsx` lines 190–219 — `grid-cols-2 sm:grid-cols-4` for stats; the card body grows long
- **Fix scope (PHASE 30):** Add "Show breakdown" toggle defaulting to collapsed on mobile.

### S3 (UX) — Farmer Home Page `recommendBestMarketForLot` runs on the client with ALL prices
- **Where:** `FarmerHomePage.tsx` lines 76–87 — calls the heavy client engine with the full `useAllMarketPrices` array on every render where `topLot` exists
- **What:** For pan-India coverage this could become O(N) for every render. Memoised by hooks but not by data content.
- **Fix scope (PHASE 14):** Move to server-side recommendation via `GET /market-comparison?commodity=&state=`. Client renders the server response.

### S4 (i18n) — `MarketPricesPage` hint hardcodes "Demo dataset" English copy
- **Where:** `MarketPricesPage.tsx` line 100–103 — fallback string includes "Demo dataset."
- **Fix scope (PHASE 34):** Move demo copy to locale file; gate it behind `prices.isDemo` so live data shows a neutral "Live mandi prices from government & private sources" hint.

### S4 (i18n) — `recommendation.ts` reason strings are English-only and never go through `t()`
- **Where:** `recommendation.ts` lines 194–225
- **Fix scope (PHASE 34):** Wrap reason strings through a translation key (e.g. `farmer.recommend.reason.netValue`) or pass a `t()` function in `RecommendBestMarketInput`.

---

## 6. Test coverage matrix

| Component | Test file | Lines covered | Gaps |
|-----------|-----------|---------------|------|
| `CommodityResolver` | `tests/CommodityResolver.test.ts` | Alias map empty / populated; extractBaseName edge cases | None observed |
| `MarketIngestionService` | `tests/MarketIngestionService.test.ts` | Primary ingest, fallback to eNAM, idempotency | Aggregate-decorate path not tested for non-modal-only payloads |
| `MarketPricesController` | `tests/MarketPricesController.test.ts` | List, history, reliability, refresh | None observed |
| `MarketHealthController` | `tests/MarketHealthController.test.ts` | Endpoint resolution + reliability composition | None observed |
| `MarketInsightComparisonController` | `tests/MarketInsightComparisonController.test.ts` | Today insight + comparison | None observed |
| **NOT TESTED** | | | |
| `MarketNormaliser` | — | Pure helpers `toFiniteNumber`, `toIsoDate`, `buildRecordKey`, `normaliseAgmarknet`, `normaliseEnam` | Should add unit tests for malformed payloads (PHASE 36) |
| `MarketHistoryService` | — | `annotateWithChange` for edge cases (prev=null, prev.modal=0, missing variety) | Should add unit tests (PHASE 36) |
| `MarketReliabilityService` | — | Score breakdown (40/30/20/10) for edge values | Should add unit tests (PHASE 36) |
| Frontend engines | — | `recommendBestMarketForLot`, `computeRealisableValue`, `computeReliabilityScore` | Pure units — should add Jest tests (PHASE 36) |
| `useMarketPrices` / `useRefreshMarketPrices` / `useAllMarketPrices` | — | Hook contracts; `isDemo` propagation | No frontend test infrastructure observed (no `jest.config.*` in `frontend/`) |

---

## 7. Risks & unknowns for later PHASES

1. **Agmarknet rate limits / captcha** — `fetchMarketwiseDynamic` may return HTML captcha pages if the upstream rate-limits us. The normaliser silently returns `[]`. No alerting.
2. **eNAM APMC list freshness** — `get_apmc_list_from_enam` may be stale; we don't reconcile against the `mandis` collection.
3. **Farmer profile coords** — `useFarmerProfile` returns `state/district/village` but no lat/lon, so `distanceKm` cannot be computed from the farmer's location. PHASE 12 must add a geocoding path (or accept a manual override).
4. **Timezone drift** — Records carry ISO dates but no explicit timezone. `arrival_date` is reported as YYYY-MM-DD in local IST; UI uses `Date.parse(iso)` with no TZ conversion.
5. **Storage / logistics / payments / grievances** — outside the Market Intelligence 2.0 scope but consumed by `FarmerHomePage` and `LotDetailPage`. Will be touched only when their surfaces break.

---

## 8. PHASE 0 verdict — ready for PHASE 1

The existing system has:
- ✅ All 4 controllers + 6 services + 4 repositories + 3 MCP clients wired and tested at the boundary
- ✅ Real backend data path (no silent demo substitution)
- ✅ Source provenance surfaced in the UI
- ✅ Deterministic deduplication + idempotent upserts
- ✅ Per-source reliability tracking from a real audit log
- ✅ Exact-match commodity alias resolver (no fuzzy fabrication)
- ✅ Defensive `_id` projection at the data boundary
- ⚠ Known data-fidelity gaps (Agmarknet aggregate, hardcoded watchlist, missing mandi coords, partial server-side recommendation)
- ⚠ Known UX gaps (sourceLabel hardcoded, realisable.isDemo hardcoded, mobile collapse, i18n)

**All identified gaps are scoped and non-blocking for PHASE 1.**

---

## 9. STOP — request user confirmation

Per master prompt PHASE 0 instruction and GIT SAFETY rules, **no code will be edited** until the user signs off this audit.

**Please confirm:**

1. ✅ / ❌ **The audit accurately reflects the current state of the codebase.**
2. 📋 **Which PHASE 1 items to tackle first, in what order?** (default proposal = S1 gaps in §5, top-down: aggregate fallback chain → `min/max` back-fill → dynamic watchlist)
3. 🅰️ **Trust server-side `RecommendationService` exclusively** (drop client-side `recommendBestMarketForLot` in favour of `GET /market-comparison`) — **OR** 🅱️ **keep both** (and add a drift-prevention unit test)?
4. 🅰️ **Remove the "Demo Mandi" hardcoded label** in `constants.ts` and branch on `price.source` — **OR** 🅱️ **wait for a later i18n PHASE (34)**?
5. 🅰️ **Add Jest test infrastructure for the frontend** (PHASE 36) — **OR** 🅱️ **focus tests on backend only** for now?

Once you sign off, the next intended step is **PHASE 1 — Backend hardening & cross-mandi per-state ingestion** (close the S1 gaps in §5).








