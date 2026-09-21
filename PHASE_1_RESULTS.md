# PHASE 1 — Implementation Results Log

> Running log of what was actually done, decisions made, test outcomes,
> and follow-ups. Read alongside `PHASE_1_CHECKLIST.md` (the plan).

---

## Session 1 — 2026-09-21

### Plan ratified
- P1 (data fidelity), P2 (canonical server engine), P3 (reliability UI), P4 (deferred).
- Architecture A: server is canonical, but the server engine is upgraded first.
- Demo label A: remove hardcoded `"Demo Mandi"` / `"Demo"` NOW.
- Tests B: backend-only with `vitest`, no frontend Jest this phase.

### Read in this session (full)
- `PHASE_0_AUDIT.md` (baseline)
- `backend/src/modules/marketIntelligence/services/MarketIngestionService.ts` (full — fabrication bugs at 384, 399–408)
- `backend/src/modules/marketIntelligence/services/MarketNormaliser.ts` (full)
- `backend/src/modules/marketIntelligence/services/RecommendationService.ts` (full — modalPrice-only sort)
- `backend/src/modules/marketIntelligence/services/MarketHistoryService.ts` (full)
- `backend/src/modules/marketIntelligence/mcp/agmarknetClient.ts` (full)
- `backend/src/modules/marketIntelligence/types.ts` (full)
- `backend/src/modules/marketIntelligence/repositories/MarketPriceRepository.ts` (full)
- `backend/src/modules/marketIntelligence/controllers/MarketPricesController.ts` (full)
- `backend/src/modules/marketIntelligence/controllers/MarketComparisonController.ts` (full)
- `backend/src/modules/marketIntelligence/controllers/MarketInsightController.ts` (full)
- `backend/src/modules/marketIntelligence/controllers/MarketHealthController.ts` (full)
- `backend/src/modules/marketIntelligence/validators/MarketValidators.ts` (full)
- `backend/src/modules/marketIntelligence/tests/MarketIngestionService.test.ts` (full — existing 5 describe blocks)
- `backend/src/modules/marketIntelligence/tests/MarketPricesController.test.ts` (full)
- `backend/src/bootstrap/jobs/marketIngestCron.ts` (full — 6-hourly schedule)
- `frontend/src/features/farmerDashboard/market-intelligence/recommendation.ts` (full — buggy sourceLabel at L259)
- `frontend/src/features/farmerDashboard/market-intelligence/realisable-value.ts` (full — isDemo:true at L140)
- `frontend/src/features/farmerDashboard/market-intelligence/constants.ts` (full — hardcoded labels at L85-86)
- `frontend/src/features/farmerDashboard/market-intelligence/index.ts` (full — barrel exports)
- `frontend/src/features/farmerDashboard/types.ts` (full — MarketPrice, MarketInsight, COMMODITIES)
- `frontend/src/features/farmerDashboard/hooks/data.ts` (full)
- `frontend/src/features/farmerDashboard/components/MarketPricesPage.tsx` (full)
- `frontend/src/features/farmerDashboard/components/MarketComparisonPage.tsx` (full)
- `frontend/src/features/farmerDashboard/components/FarmerHomePage.tsx` (full)

### Implementation progress
- ✅ **DONE — P1.2** (decorateAgmarknetAggregate fabrication fix)
  - Removed `min = max = modalRaw` back-fill at former L399–408
  - Removed `marketLabel = '${stateName} (state aggregate)'` fabrication
  - Aggregate rows without an upstream `mkt_name` are now DROPPED (not persisted)
  - Aggregate rows without an upstream `state_name` (and no `target.state` filter) are now DROPPED — no more "India" fallback
  - Every surviving decorated row gets `isAggregate: true`
  - `MarketPriceRecord.isAggregate?: boolean` added to `types.ts`
  - Threaded through `MarketNormaliser.buildRecord()` and `normaliseAgmarknet()`
  - Exported `decorateAgmarknetAggregate` for direct unit testing
- **Tests added (6 new):**
  - `does NOT fabricate a mandi name when upstream omits mkt_name`
  - `does NOT fabricate a mandi name when upstream supplies one — preserved verbatim`
  - `does NOT back-fill min_price / max_price from modal_price`
  - `PRESERVES min_price / max_price when upstream actually supplies them`
  - `tags every decorated row with isAggregate: true`
  - `does NOT fall back to a synthetic "India" state label`
- **Test results:** All 41 marketIntelligence vitest tests pass (3 test files). No regressions in MarketIngestionService/MarketPricesController/MarketInsightComparisonController.
- **Pre-existing failures NOT caused by PHASE 1:** `CropService.test.ts` and `CropRepository.integration.test.ts` failures (integration test pollution against real MongoDB). Defer — not part of this phase.
- ✅ **DONE — P1.3** (expand commodity watchlist from 5 → 18 commodities)
  - Created `backend/src/modules/marketIntelligence/config/marketWatchlist.config.ts` with tiered coverage:
    - **HIGH** (4 perishables + Chilli): Tomato, Onion, Potato, Chilli — `refreshHours: 4–6`
    - **MEDIUM** (10 staples/oilseeds/fibre): Rice, Wheat, Maize, Cotton, Soybean, Groundnut, Black Gram, Green Gram, Pigeon Pea, Mustard — `refreshHours: 8–12`
    - **LOW** (4 cash crops + spices): Sugarcane, Turmeric, Coriander, Cumin — `refreshHours: 24`
  - `DEFAULT_WATCHLIST` is now an alias for the full watchlist (backward-compatible export)
  - Module-load log: `Watchlist loaded: 18 commodities (HIGH/MEDIUM/LOW tiers…)`
  - NOTE: Tier-aware cron cadences are *documented* (`refreshHours` per entry) but not yet *wired* — operational change deferred to keep Agmarknet load profile stable. Single 6-hourly run continues.
  - Correction: COMMODITIES list has **18** entries, not 19 as the audit implied.
- **Tests added (10 new):** Watchlist coverage contract — every advertised commodity covered, all 3 tiers populated, HIGH smaller than MEDIUM, refresh cadence monotonic, targets derived from config.
- **Test results:** 51 marketIntelligence vitest tests pass (4 files). No regressions.
- 🔄 Next: P2.4–6 (multi-factor server-side scoring in RecommendationService)


