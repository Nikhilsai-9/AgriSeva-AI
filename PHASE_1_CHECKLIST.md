# PHASE 1 — Market Intelligence 2.0 Implementation Checklist

> **Goal:** Eliminate fabricated data, expand coverage, make the server the
> canonical recommendation engine, surface reliability honestly in the UI.
>
> **Scope:** Backend = marketIntelligence module; Frontend =
> features/farmerDashboard/{market-intelligence,components}.
> P4 (analytics, AI/ML, prediction) is deferred.

---

## Priority P1 — Data Fidelity (NO FABRICATION)

### P1.1 — Verify `fetchDashboardPerMandi` returns real per-mandi rows
- [x] Confirmed `fetchDashboardPerMandi` exists (agmarknetClient.ts L167-195)
- [x] Confirmed it uses `get_dashboard_data` with `state_id` filter
- [x] Confirmed it returns market/district/min/max/modal fields when invoked with a real state
- **Decision:** No new client tool needed. The bug is in the *consumer* of the dashboard response (P1.2).

### P1.2 — Fix `decorateAgmarknetAggregate` data fabrication 🔴
- [x] Located: `backend/src/modules/marketIntelligence/services/MarketIngestionService.ts` L364-442
- [x] **Remove `min_price = String(modalRaw)` / `max_price = String(modalRaw)` back-fill** (L399-408)
- [x] **Stop fabricating mandi name** `marketLabel = '${stateName} (state aggregate)'` (L384)
- [x] **Add `isAggregate: true` flag** on decorated records so consumers know these are state-level (not per-mandi) rows
- [x] Add `isAggregate?: boolean` to `MarketPriceRecord` type
- [x] Thread `isAggregate` through `MarketNormaliser.buildRecord()` and `normaliseAgmarknet()`
- [x] **Tests:** 6 new assertions (see PHASE_1_RESULTS.md)
- [x] **Exported** `decorateAgmarknetAggregate` for direct unit testing

### P1.3 — Expand commodity watchlist from 5/18 → 18/18 with priority tiers 🔴
- [x] Located: `MarketIngestionService.ts` L34-40 `DEFAULT_WATCHLIST` = 5 commodities
- [x] Create `backend/src/modules/marketIntelligence/config/marketWatchlist.config.ts`
- [x] HIGH (vegetables, perishables), MEDIUM (cereals, pulses, oilseeds), LOW (spices, cash crops) — covers all 18 `COMMODITIES`
- [x] Replace `DEFAULT_WATCHLIST` import with the new config (kept export name for backward compat)
- [x] **Tests:** 10 new assertions in `tests/marketWatchlist.config.test.ts`
- [ ] **DEFERRED:** Tier-aware cron cadence wiring (operational change — see PHASE_1_RESULTS.md P1.3 note). Cadence intent is documented per-entry (`refreshHours`).

---

## Priority P2 — Server as Canonical Engine (NO CLIENT/SERVER DRIFT)

### P2.4–6 — Multi-factor scoring in `RecommendationService.compare` 🔴
- [x] Located: `backend/src/modules/marketIntelligence/services/RecommendationService.ts`
- [x] Current: sorts by highest `modalPrice` only — single factor
- [x] New module: `backend/src/modules/marketIntelligence/services/scoring.ts`
  - `SERVER_RECOMMENDATION_WEIGHTS` mirrors FE `RECOMMENDATION_WEIGHTS` (50/15/15/10/10)
  - `DEGRADED_DEFAULTS` = `{distance:50, demand:30, paymentReliability:30, qualityMatch:60}`
  - `scoreRow()`, `scoreRows()`, `isDegradedMode()` exported
- [x] When buyer/lot/grievance inputs absent (current API contract), factor scores DEGRADE gracefully:
  - **netValue (50)** — `modalPrice` normalized within the comparison set
  - **distance (15)** — degraded default 50 (server has no distance data)
  - **demand (15)** — degraded default 30 (no buyer data on server; **not 50** to stay aligned with FE `quantityDemandScore(buyer=null) === 30`)
  - **paymentReliability (10)** — degraded default 30 (no buyer directory)
  - **qualityMatch (10)** — degraded default 60 (no buyer directory)
- [x] Documented INPUTS → WEIGHTS → DEGRADED DEFAULTS → OUTPUT in the service JSDoc
- [x] `RecommendationService.compare` now returns `score`, `breakdown`, `reasons`, `isDegraded: true` in the recommendation payload
- [x] FE `recommendBestMarketForLot` engine KEPT (stop-condition: do not retire; needs `FarmerLot + Buyer[] + Grievance[]`). Server engine only supersedes for `GET /market-comparison`.
- [x] **Tests:** 13 scoring tests + 5 RecommendationService tests (82 total pass). Weight-drift test fails if anyone changes a weight without updating the other.

### P2.7 — Replace hardcoded "Demo Mandi" / "Demo" labels 🔴
- [x] Located: `frontend/src/features/farmerDashboard/market-intelligence/constants.ts` L85-86
- [x] Located: `frontend/src/features/farmerDashboard/market-intelligence/recommendation.ts` L259-265 (buggy `sourceLabel`)
- [x] Consumers: `MarketComparisonPage.tsx` uses the buggy one (uses own `t()` call already; small fix still pending — see below)
- [x] `MarketPricesPage.tsx` has its OWN local `sourceLabel` (good, line 46) — NOT affected
- [x] Added `getSourceLabel(source, isDemo?)` to `constants.ts`
- [x] Marked `MARKET_SOURCE_LABEL` / `MANDI_SOURCE_LABEL` as `@deprecated` (kept for compat)
- [x] Rewrote `sourceLabel()` in `recommendation.ts` to branch on `price.source` (agmarknet / enam / mcp-* / empty / unknown)
- [x] Exported `getSourceLabel` from `index.ts`
- [ ] Update `MarketComparisonPage.tsx` to use the new helper (follow-up — its existing `t()` call is i18n-correct, only minor tidy-up needed)

### P2.8 — Fix `realisable-value.ts:140` hardcoded `isDemo: true` 🔴
- [x] Located: `frontend/src/features/farmerDashboard/market-intelligence/realisable-value.ts` L140
- [ ] Compute `isDemo` from `price.source === 'demo' || price.source === undefined`
- [ ] Update `RealisableValue.isDemo` type to `boolean` (already is)

---

## Priority P3 — Surface Reliability in UI

### P3.9 — Add reliability chip + freshness hint 🔴
- [x] Backend already has `MarketReliabilityService` and `GET /market-prices/reliability`
- [x] `MarketPricesPage` already has stale/fresh logic (line 35, 88-94)
- [x] `useMarketReliability(source?)` already exists in `hooks/data.ts:593`
- [x] New component: `components/MarketReliabilityChip.tsx`
  - Band helpers: `bandForScore`, `bandLabel`, `bandClass`, `BandIcon`
    - A — Excellent (80+) emerald · B — Good (60–79) sky · C — Fair (40–59) amber · D — Limited (0–39) rose
  - `<ReliabilityChip source="…" />` — inline badge, renders `null` when data missing (never fabricates)
  - `<ReliabilityFooter />` — per-source strip for `MarketPricesPage` + `MarketComparisonPage`
  - `<LowReliabilityBanner threshold={60} />` — soft warning when weakest source drops below threshold
- [x] Wired into `MarketPricesPage` (banner + footer), `FarmerHomePage` (banner + chip), `MarketComparisonPage` (banner + footer)
- [ ] Optional follow-up: run vitest unit on `bandForScore` / `bandLabel` — pure functions, easy to add when Jest is introduced (PHASE 36)

---

## Priority P4 — DEFERRED (NOT IN PHASE 1)

- ❌ P4.10 — Advanced analytics
- ❌ P4.11 — Price prediction / forecasting (STOP condition)
- ❌ P4.12 — AI sale-window recommendation (STOP condition)

---

## Test Discipline

- Backend: `pnpm test:ci` (vitest) after every backend change
- Frontend: type-check only this phase (`pnpm tsc --noEmit`) — no Jest introduction

## Git Discipline

- One focused commit per logical group (P1.2, P1.3, P2.4-6, P2.7-8, P3.9)
- Never commit the 8 unrelated modified files in the working tree
- No force-push; no rebases of `main`

## Latest Commits

| Commit | Group | Summary |
|--------|-------|---------|
| `63b02b85d` | P1.2 + P1.3 | Fabrication fix + tiered watchlist (16 new tests, 51 total) |
| `a4e8af3e8` | P2.4 + P2.7 | Server-side 5-factor scoring + kill hardcoded "Demo Mandi" (18 new tests, 82 total) |
| `eb02deab6` | P3.9 | Reliability UI surface (chip/footer/banner) + `isAggregate` provenance badge |
| `f890f3490` | docs | Log P3.9 commit hash in this checklist |
| `(next)`  | P1 closure doc | Add `PHASE_1_DONE.md` retro + pointer here |

---

> **Closure document:** `PHASE_1_DONE.md` — TL;DR, what shipped, test
> progression, git history, STOP-condition compliance, deferred items,
> files touched, and what this means for Phase 2+.
