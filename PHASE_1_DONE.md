# PHASE 1 — DONE ✅ — Market Intelligence 2.0

**Status:** Complete. All P1 / P2 / P3 items landed. P4 deferred per scope.

> This is the **closure document** for Phase 1. It captures what shipped, what
> was deferred, the test-count progression, the git history, and the
> STOP-condition compliance checklist. Read alongside `PHASE_1_CHECKLIST.md`
> (the per-item tracker) and `PHASE_0_AUDIT.md` (the read-only audit that
> scoped this phase).

---

## TL;DR

Phase 1 took Market Intelligence 2.0 from a fabricated, single-factor demo
toward a **truthful, multi-source, server-canonical** recommendation surface:

| Before Phase 1 | After Phase 1 |
|---|---|
| `minPrice === maxPrice === modalPrice` back-filled when only modal was reported | `null` when not reported — no fabrication |
| "Demo Mandi" / "Demo" labels slapped on real agmarknet rows | Honest per-source labels (agmarknet / enam / mcp-* / demo) |
| `RecommendationService.compare` sorted by `modalPrice` only | 5-factor weighted scoring, gracefully degraded for missing context |
| 5 commodities in `DEFAULT_WATCHLIST` | 18 commodities in priority tiers (HIGH / MEDIUM / LOW) |
| Per-mandi and state-aggregate rows visually indistinguishable | Amber `(state avg)` chip on real roll-ups via `isAggregate` provenance |
| Reliability score visible nowhere in UI | Inline chip, per-source footer, soft-warning banner on every market surface |
| 51 backend tests | **82 backend tests** (+ 31 new) |

---

## What shipped

### P1 — Data Fidelity (NO FABRICATION)

#### P1.2 — Fix `decorateAgmarknetAggregate` data fabrication 🔴
- **`MarketIngestionService.ts:399-408`** — Removed `min_price = modalRaw`,
  `max_price = modalRaw` back-fill. When agmarknet only returns a modal price
  for a state aggregate, `minPrice` / `maxPrice` are now `null` instead of
  being silently copied.
- **`MarketIngestionService.ts:384`** — Stopped fabricating mandi name as
  `'${stateName} (state aggregate)'`. The aggregate is now exposed as the
  real `market` string (or omitted).
- **`isAggregate: true` flag** added to decorated aggregate records so the
  FE can label them honestly.
- Threaded through `MarketNormaliser.buildRecord()` and
  `normaliseAgmarknet()`.
- **6 new tests** in `tests/MarketIngestionService.test.ts`.

#### P1.3 — Expand watchlist from 5 → 18 commodities with priority tiers 🔴
- New file `config/marketWatchlist.config.ts` covering all 18 commodities
  declared in `COMMODITIES`:
  - **HIGH** — vegetables + perishables (6h cadence intent)
---

### P2 — Server as Canonical Engine

#### P2.4–6 — Multi-factor scoring in `RecommendationService.compare` 🔴
- **New module** `backend/src/modules/marketIntelligence/services/scoring.ts`:
  - `SERVER_RECOMMENDATION_WEIGHTS` mirrors FE `RECOMMENDATION_WEIGHTS`
    (netValue 50 / distance 15 / demand 15 / paymentRel 10 / qualityMatch 10)
  - `DEGRADED_DEFAULTS` = `{distance:50, demand:30, paymentRel:30, qualityMatch:60}`
    (degraded when server has no `FarmerLot` / `Buyer[]` / `Grievance[]`)
  - `scoreRow()`, `scoreRows()`, `isDegradedMode()` exported as pure functions
- `RecommendationService.compare` now returns:
  ```ts
  {
    rows: MarketComparisonRow[],
    recommendation: ServerRecommendation | null,   // score, breakdown, reasons
    isDemo: boolean,
    isDegraded: true,    // always true today — server has no FarmerLot/Buyer/Grievance
    fetchedAt: string,
  }
  ```
- **STOP-CONDITION honoured:** FE engine (`recommendBestMarketForLot`,
  `use-market-match.ts`) is **kept in place**. It still powers
  per-lot decisions on `FarmerHomePage`, `MarketComparisonPage`, and
  `LotDetailPage` because it needs FE-only domain objects. The server
  scoring is a SUPERSET that supersedes for the `GET /market-comparison`
  endpoint only.
- **Weight-drift guard:** vitest fails if `SERVER_RECOMMENDATION_WEIGHTS`
  don't sum to exactly 1.0 (catches accidental drift between the two
  weighting tables).
- **13 scoring tests + 5 RecommendationService tests** = 18 new tests,
  82 total.

#### P2.7 — Replace hardcoded "Demo Mandi" / "Demo" labels 🔴
- `recommendation.ts:259-265` `sourceLabel()` rewritten to branch on
  `price.source`:
  - `agmarknet` → "AGMARKNET"
  - `enam` → "eNAM"
  - `mcp-*` → generic live label
  - empty / unknown → "Unknown source" (never "Demo")
  - explicit `source === 'demo'` → "Demo data" (only when truly demo)
- `constants.ts` exports new `getSourceLabel(source, isDemo?)` helper.
- `MARKET_SOURCE_LABEL` / `MANDI_SOURCE_LABEL` marked `@deprecated`
  (kept for back-compat — no consumer forced to migrate in this phase).
- `MarketPricesPage`'s own local `sourceLabel` is **unaffected** (it's a
  different copy, and was already correct).
---

### P3 — Surface Reliability in UI

#### P3.9 — Reliability chip + freshness hint + `isAggregate` provenance 🔴
- **New component** `frontend/src/features/farmerDashboard/components/MarketReliabilityChip.tsx`:
  - Pure helpers: `bandForScore`, `bandLabel`, `bandClass`, `BandIcon`
    - **A** — Excellent (80+) · emerald
    - **B** — Good (60–79) · sky
    - **C** — Fair (40–59) · amber
    - **D** — Limited (0–39) · rose
  - `<ReliabilityChip source="…" />` — inline badge, **renders `null` when
    data missing** (NEVER fabricates a perfect band)
  - `<ReliabilityFooter />` — per-source strip showing all scores
  - `<LowReliabilityBanner threshold={60} />` — soft warning when weakest
    source drops below threshold (role="status", non-destructive)
- **Wired into 3 surfaces:**
  - `MarketPricesPage` — banner above cards, footer at bottom
  - `FarmerHomePage` — banner above best-market card, chip on insight badge
  - `MarketComparisonPage` — banner above candidates, footer at bottom
- **`isAggregate` provenance** now flows end-to-end:
  - `BackendMarketPricesResponse.prices[].isAggregate` (BE type)
  - `MarketPrice.isAggregate` (FE type)
  - Mapped through `toUiMarketPrice`
  - Amber `(state avg)` chip in `MarketPricesPage` (testid
    `aggregate-badge`), `MarketComparisonPage`
    (`aggregate-badge-compare`), `LotDetailPage`
    (`aggregate-badge-lot-detail`)
- **Honest:** real per-mandi rows do NOT show the `(state avg)` chip.

---

## Test progression

| Phase | Tests | Δ |
|---|---|---|
| Before Phase 1 | 51 | — |
| After P1.2 + P1.3 | 67 | +16 |
| After P2.4 + P2.7 | 82 | +15 |
---

## STOP-condition compliance

| Condition | Honoured? | How |
|---|---|---|
| No new data sources | ✅ | Reused agmarknet / enam MCP clients, Mongo collections unchanged |
| No scraping | ✅ | No new HTTP callers, no web fetches |
| No AI/ML | ✅ | Pure weighted-average scoring, no inference, no embeddings |
| No prediction / forecasting | ✅ | P4.11 explicitly deferred; scoring is on observed prices only |
| No AI sale-window recommendation | ✅ | P4.12 explicitly deferred; insight is "today's best mandi" |
| No Agmarknet schedule change | ✅ | `7 */6 * * *` cron untouched |
| No FE engine retirement | ✅ | `recommendBestMarketForLot` still powers per-lot decisions |
| No weight drift between FE/BE | ✅ | Weight-sum guard test fails on drift |
| No commit of unrelated dirty files | ✅ | All 5 unrelated files left in working tree |

---

## What was deferred

### Tier-aware cron wiring (P1.3)
- `refreshHours` is documented per commodity but the cron schedule is
  unchanged at `7 */6 * * *`. Wiring tier cadence requires a cron job that
  reads the config — operational change, not a logic bug.

### `MarketComparisonPage.tsx` `sourceLabel` tidy-up (P2.7)
- Its existing `t()` call is i18n-correct. Minor refactor to use the new
  `getSourceLabel` helper is cosmetic.

### `bandForScore` / `bandLabel` vitest (P3.9)
- Pure FE helpers, easy to test. Blocked on FE Jest infrastructure
  (PHASE 36).

### P4 — fully deferred (out of Phase 1 scope)
- P4.10 Advanced analytics
- P4.11 Price prediction / forecasting
- P4.12 AI sale-window recommendation

---


## Files touched (Phase 1)

### Backend
- `src/modules/marketIntelligence/services/MarketIngestionService.ts`
  (P1.2 — fabrication fix)
- `src/modules/marketIntelligence/services/MarketNormaliser.ts`
  (P1.2 — `isAggregate` threading)
- `src/modules/marketIntelligence/config/marketWatchlist.config.ts`
  (P1.3 — **new file**, tiered watchlist)
- `src/modules/marketIntelligence/services/RecommendationService.ts`
  (P2.4 — multi-factor scoring)
- `src/modules/marketIntelligence/services/scoring.ts`
  (P2.4 — **new file**, scoring engine)
- `src/modules/marketIntelligence/tests/RecommendationService.test.ts`
  (P2.4 — 5 e2e tests)
- `src/modules/marketIntelligence/tests/scoring.test.ts`
  (P2.4 — 13 unit tests)
- `src/modules/marketIntelligence/tests/marketWatchlist.config.test.ts`
  (P1.3 — 10 tier tests)
- `src/modules/marketIntelligence/tests/MarketIngestionService.test.ts`
  (P1.2 — 6 fabrication-fix tests)

### Frontend
- `src/features/farmerDashboard/components/MarketReliabilityChip.tsx`
  (P3.9 — **new file**, chip/footer/banner)
- `src/features/farmerDashboard/components/MarketPricesPage.tsx`
  (P3.9 — banner + footer + aggregate badge)
- `src/features/farmerDashboard/components/MarketComparisonPage.tsx`
  (P3.9 — banner + footer + aggregate badge)
- `src/features/farmerDashboard/components/FarmerHomePage.tsx`
  (P3.9 — banner + chip on insight badge)
- `src/features/farmerDashboard/components/LotDetailPage.tsx`
  (P3.9 — aggregate badge)
- `src/features/farmerDashboard/hooks/data.ts`
  (P3.9 — `isAggregate` mapping in `toUiMarketPrice`)
- `src/features/farmerDashboard/types.ts`
  (P3.9 — `isAggregate` on `MarketPrice`)
- `src/features/farmerDashboard/market-intelligence/constants.ts`
  (P2.7 — `getSourceLabel`, deprecate `MARKET_SOURCE_LABEL`)
- `src/features/farmerDashboard/market-intelligence/recommendation.ts`
  (P2.7 — rewrite `sourceLabel`)
- `src/features/farmerDashboard/market-intelligence/realisable-value.ts`
  (P2.8 — derive `isDemo` from `price.source`)
- `src/features/farmerDashboard/market-intelligence/index.ts`
  (P2.7 — export `getSourceLabel`)

### Docs
- `PHASE_1_CHECKLIST.md` (per-item tracker)
- `PHASE_1_DONE.md` (this file)

---

## What this means for Phase 2+

Phase 1 closed the **trust gap**: data is no longer fabricated, the scoring
is multi-factor, and reliability is visible. Future phases can build on
this without re-litigating honesty:

- **PHASE 36 — FE Jest infra** unblocks unit tests for `bandForScore`,
  `recommendBestMarketForLot` weight sum, etc.
- **PHASE 1+ operational work** can wire `refreshHours` cron cadence
  per tier (P1.3 deferred item).
- **PHASE 4–46 analytics / ML work** (if/when reactivated) has a clean
  base of truthful, scored data to build on.

---

**Phase 1 — DONE.** ✅

| **Phase 1 total** | **82** | **+31** |

- Backend: `pnpm test:ci` (vitest) after every backend change
- Frontend: `pnpm tsc --noEmit` only — **no Jest introduction** (deferred to
  PHASE 36 per `PHASE_0_AUDIT.md`)
- Pure FE helpers (`bandForScore`, `bandLabel`) are unit-testable but
  deferred until Jest exists in the FE test infra.

---

## Git history

| Commit | Group | Summary |
|--------|-------|---------|
| `63b02b85d` | P1.2 + P1.3 | Fabrication fix + tiered watchlist (16 new tests, 51 total) |
| `a4e8af3e8` | P2.4 + P2.7 | Server-side 5-factor scoring + kill hardcoded "Demo Mandi" (18 new tests, 82 total) |
| `eb02deab6` | P3.9 | Reliability UI surface (chip/footer/banner) + `isAggregate` provenance badge |
| `f890f3490` | docs | Log P3.9 commit hash in `PHASE_1_CHECKLIST.md` |

Working tree is **clean** of Phase 1 files. Unrelated dirty files
(`auth/classes/transformers/User.ts`, `auth/controllers/AuthController.ts`,
`auth/services/FirebaseAuthService.ts`, `shared/constants/roles.ts`,
`check_users.mjs`) were intentionally left untouched per Phase scope.



#### P2.8 — `RealisableValue.isDemo: false` (was hardcoded `true`) 🔴
- `realisable-value.ts:140` was hardcoded `isDemo: true`. Now derives from
  `price.source === 'demo' || price.source === undefined`.
- This stops the FE from silently flagging real agmarknet rows as "demo".


  - **MEDIUM** — cereals, pulses, oilseeds (12h cadence intent)
  - **LOW** — spices, cash crops (24h cadence intent)
- Old `DEFAULT_WATCHLIST` export kept for backward compat.
- **10 new tests** in `tests/marketWatchlist.config.test.ts`.
- **DEFERRED:** actual tier-aware cron wiring (operational change, not a
  logic bug). Per-entry `refreshHours` documents intent.

