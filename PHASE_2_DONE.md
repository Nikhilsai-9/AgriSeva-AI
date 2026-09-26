# PHASE 2 — DONE

**Status:** Phase 2 closed. Six of seven items shipped (P2.A, P2.B,
P2.C, P2.E, P2.F, P2.G). P2.D (captcha detection) explicitly deferred
to PHASE 3 §P3.A with rationale recorded.

**Companion docs:**
- `PHASE_2_PLAN.md` — the original plan
- `PHASE_2_RESULTS.md` — detailed results, per-item test counts
- `PHASE_1_DONE.md` — predecessor phase closure

---

## 1. Summary

| Slice                                | Before P2 | After P2 | New |
| ------------------------------------ | --------- | -------- | --- |
| Backend `marketIntelligence` tests   | 98        | **178**  | +80 |
| Frontend `farmerDashboard` tests     | 0         | **61**   | +61 |
| **Total new tests in PHASE 2**       |           |          | **+141** |

- **0 regressions** introduced by any P2 change.
- All edits confined to scope per the STOP-conditions
  (`marketIntelligence/**`, `farmerDashboard/**`, the four allowed
  FE support files, and the docs folder).
- Every slice commits in isolation so each item can be reverted
  independently if a regression is discovered downstream.

## 2. Items shipped

| ID  | Title                                          | Tests added | Commit    |
| --- | ---------------------------------------------- | ----------- | --------- |
| P2.A | Tier-aware cron cadence (HIGH/MED/LOW)         | +16 BE      | phase2-A  |
| P2.B | Frontend Vitest infrastructure activation      | +51 FE      | phase2-B  |
| P2.C | Backend depth tests (Normaliser/History/Reliab) | +57 BE      | phase2-C  |
| P2.E | Timezone hardening (IST-anchored `todayIso`)   | +5 BE       | phase2-E  |
| P2.F | `MarketComparisonPage` cosmetic tidy-up        | 0 (cosmetic) | phase2-F |
| P2.G | `realisable-value.isDemo` derived from source   | +10 FE      | phase2-G  |

## 3. Items deferred

| ID  | Title                  | Reason |
| --- | ---------------------- | ------ |
| P2.D | Captcha detection     | Most invasive of the four remaining items — touches `MarketNormaliser`, `MarketIngestionResult` shape, `MarketHealthController`, and `data_update_log`. Cleanly scope-able as **PHASE 3 §P3.A** with full design + migration. Captcha markers (`<title>Just a moment`, `cf-chl-bypass`, `g-recaptcha`) and the `captchaSuspected: boolean` propagation path are already noted in `PHASE_2_PLAN.md` so the next phase can pick up immediately. |

  markers (`<title>Just a moment`, `cf-chl-bypass`, `g-recaptcha`) and the `captchaSuspected: boolean` propagation path are already noted in `PHASE_2_PLAN.md` so the next phase can pick up immediately. |

## 4. Highlights

### P2.E — IST-anchored dates (the most subtle fix of the phase)
- `todayIso()` was returning UTC, which silently mis-classified
  records fetched between 18:30 and 24:00 IST as "yesterday" (or
  worse, accepted arrivals dated in the future). The fix uses
  `Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata'})` to
  guarantee an ISO-shaped `YYYY-MM-DD` regardless of host TZ.
- `MarketPriceRecord` now stamps `timezone: 'Asia/Kolkata'` on
  every ingested row, locking the semantic of `arrivalDate`.

### P2.G — single source of truth for `isDemo`
- The old code hardcoded `isDemo: true` on every computed
  `RealisableValue`, which silently downgraded the farmer's
guard.

## 5. Files touched

### Backend
- `backend/src/modules/marketIntelligence/services/tieredMarketCron.ts` (new)
- `backend/src/modules/marketIntelligence/services/marketIngestCron.ts` (legacy retained for `POST /refresh`)
- `backend/src/modules/marketIntelligence/services/MarketIngestionService.ts` (added `runWatchlistForTier`)
- `backend/src/modules/marketIntelligence/types.ts` (added `timezone?: 'Asia/Kolkata'`, IST JSDoc on `arrivalDate`)
- `backend/src/modules/marketIntelligence/services/MarketNormaliser.ts` (`todayIso` → IST, `formatIstDate` helper, `buildRecord` stamps `timezone`)

### Backend tests
- `backend/src/modules/marketIntelligence/tests/MarketNormaliser.test.ts` (+5 IST tests, +formatIstDate import)
- `backend/src/modules/marketIntelligence/tests/MarketHistoryService.test.ts` (new, +16)
- `backend/src/modules/marketIntelligence/tests/cronSchedule.test.ts` (new, +5)

### Frontend
- `frontend/vitest.config.ts` (new)
- `frontend/src/test/setup.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/realisable-value.ts` (P2.G — `deriveIsDemo`, JSDoc fix)
- `frontend/src/features/farmerDashboard/components/MarketComparisonPage.tsx` (P2.F — `getSourceLabel` import)

### Frontend tests
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/constants.test.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/realisable-value.test.ts` (existing + P2.G +10)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/recommendation.test.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/reliability.test.ts` (new)

### Docs
- `PHASE_2_RESULTS.md` (updated to reflect P2.E/F/G completion and P2.D deferral)
- `PHASE_2_DONE.md` (this file)

- `PHASE_2_DONE.md` (this file)

## 6. STOP-condition compliance

- ✅ All edits confined to the allowed scopes.
- ✅ No single change introduced more than 200 net lines outside of
  test files.
- ✅ BE `npx vitest run src/modules/marketIntelligence` → **13 files /
  178 tests / 0 failures**.
- ✅ FE `npm test -- --run` → **61 tests / 0 failures**.
- ✅ Pre-existing failures in unrelated modules (Crop / Auth) are
  documented and out of scope.

---

**Phase 2 closed.** Phase 3 is unblocked and can begin with P3.A
(captcha detection) directly.


- `backend/src/modules/marketIntelligence/tests/MarketReliabilityService.test.ts` (new, +8)
- `backend/src/modules/marketIntelligence/tests/MarketIngestionService.tiered.test.ts` (new, +11)
- `backend/src/modules/marketIntelligence/tests/MarketIngestionService.test.ts` (extended with tier branch)
- `backend/src/modules/marketIntelligence/tests/cronSchedule.test.ts` (new, +5)


  net-realisable UI for live agmarknet / eNAM prices. The fix
  introduces a single helper `deriveIsDemo(price)` and routes
  every price-level `isDemo` decision through it. The 10 new
  tests lock in: agmarknet→false, enam→false, demo→true,
  missing source→true (legacy fixture safety), null/undefined
  price→true, and uppercase `DEMO`→true (case-insensitive).

### P2.B — frontend Vitest infrastructure
- The most consequential infrastructure change of the phase.
  Before P2, the FE pure helpers had **zero** unit-test coverage.
  After P2, four FE helper files (constants, realisable-value,
  recommendation, reliability) have 51 tests between them, and
  the test runner is wired into `package.json` (`npm test`,
  `npm run test:ci`) so every future FE change has a runnable
  guard.


