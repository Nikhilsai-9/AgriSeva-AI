# PHASE 2 -- DONE

**Status:** Phase 2 closed. **All seven items shipped** (P2.A, P2.B,
P2.C, P2.D, P2.E, P2.F, P2.G). The earlier "P2.D deferred to
PHASE 3 §P3.A" wording in this doc was written **before** P2.D
actually landed in commit `44a5ad775`, so this doc has been
reconciled with reality.

**Companion docs:**
- `PHASE_2_PLAN.md` -- the original plan
- `PHASE_2_RESULTS.md` -- detailed results, per-item test counts
- `PHASE_1_DONE.md` -- predecessor phase closure

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

| ID   | Title                                          | Tests added  | Commit         |
| ---- | ---------------------------------------------- | ------------ | -------------- |
| P2.A | Tier-aware cron cadence (HIGH/MED/LOW)         | +16 BE       | phase2-A       |
| P2.B | Frontend Vitest infrastructure activation      | +51 FE       | phase2-B       |
| P2.C | Backend depth tests (Normaliser/History/Reliab)| +57 BE       | phase2-C       |
| P2.D | Captcha / challenge-page detection             | +18 BE       | `44a5ad775`    |
| P2.E | Timezone hardening (IST-anchored `todayIso`)   | +5 BE        | phase2-E       |
| P2.F | `MarketComparisonPage` cosmetic tidy-up        | 0 (cosmetic) | phase2-F       |
| P2.G | `realisable-value.isDemo` derived from source  | +10 FE       | phase2-G       |

## 3. Items deferred

_None. All seven PHASE 2 items shipped on `agriseva/main`._

## 4. Highlights

### P2.D -- Captcha / challenge-page detection (the right closing move)
- For months, agmarknet returning a Cloudflare or reCAPTCHA page on
  rate-limit silently looked like a successful empty fetch. P2.D
  closes that gap with `CAPTCHA_MARKERS` + `detectCaptchaIn*`
  helpers in `MarketNormaliser.ts`, and short-circuits the
  ingestion path with `captchaSuspected: true` +
  `errorCategory: 'captcha'` before records are ever written.
- Operators see the signal via `MarketHealthController`’s
  `captchaSuspected` boolean and the `captchaIncidentsLast24h`
  counter on the per-source reliability snapshot -- no scraping
  logs needed.
- Intentionally **not** folded into the reliability score: a
  captcha is an upstream rate-limit, not a defect in our code.

### P2.E -- IST-anchored dates (the most subtle fix of the phase)
- `todayIso()` was returning UTC, which silently mis-classified
  records fetched between 18:30 and 24:00 IST as "yesterday" (or
  worse, accepted arrivals dated in the future). The fix uses
  `Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata'})` to
  guarantee an ISO-shaped `YYYY-MM-DD` regardless of host TZ.
- `MarketPriceRecord` now stamps `timezone: 'Asia/Kolkata'` on
  every ingested row, locking the semantic of `arrivalDate`.

### P2.G -- single source of truth for `isDemo`
- The old code hardcoded `isDemo: true` on every computed
  `RealisableValue`, which silently downgraded the farmer's
  net-realisable UI for live agmarknet / eNAM prices. The fix
  introduces a single helper `deriveIsDemo(price)` and routes
  every price-level `isDemo` decision through it. The 10 new
  tests lock in: agmarknet -> false, enam -> false, demo -> true,
  missing source -> true (legacy fixture safety), null/undefined
  price -> true, and uppercase `DEMO` -> true (case-insensitive).

### P2.B -- frontend Vitest infrastructure
- The most consequential infrastructure change of the phase.
  Before P2, the FE pure helpers had **zero** unit-test coverage.
  After P2, four FE helper files (constants, realisable-value,
  recommendation, reliability) have 51 tests between them, and
  the test runner is wired into `package.json` (`npm test`,
  `npm run test:ci`) so every future FE change has a runnable
  guard.

## 5. Files touched

### Backend (production)
- `backend/src/modules/marketIntelligence/services/tieredMarketCron.ts` (new)
- `backend/src/modules/marketIntelligence/services/marketIngestCron.ts` (legacy retained for `POST /refresh`)
- `backend/src/modules/marketIntelligence/services/MarketIngestionService.ts` (`runWatchlistForTier`, captcha short-circuit on `result.data` + `result.error`, `errorCategory: 'captcha'` plumbing)
- `backend/src/modules/marketIntelligence/services/MarketNormaliser.ts` (`todayIso` -> IST, `formatIstDate` helper, `CAPTCHA_MARKERS` + `detectCaptchaInString` / `detectCaptchaInPayload` / `detectCaptchaInError`, `buildRecord` stamps `timezone`)
- `backend/src/modules/marketIntelligence/services/ReliabilityService.ts` (captcha count in 24h window, captcha reason surfaced separately from score)
- `backend/src/modules/marketIntelligence/types.ts` (`timezone?: 'Asia/Kolkata'` on `MarketPriceRecord`, `captchaSuspected: boolean` on `MarketIngestionResult`, `captchaIncidentsLast24h` on `MarketReliabilitySnapshot`)
- `backend/src/modules/marketIntelligence/controllers/MarketHealthController.ts` (`captchaSuspected` field on `health()`)
- `backend/src/modules/marketIntelligence/repositories/DataUpdateLogRepository.ts` (`DataUpdateErrorCategory` enum, `captchaIncidentsLast24h(sourceId)`)

### Backend tests
- `backend/src/modules/marketIntelligence/tests/MarketNormaliser.test.ts` (+5 IST tests, +formatIstDate import)
- `backend/src/modules/marketIntelligence/tests/MarketHistoryService.test.ts` (new, +16)
- `backend/src/modules/marketIntelligence/tests/MarketReliabilityService.test.ts` (new, +8)
- `backend/src/modules/marketIntelligence/tests/MarketIngestionService.tiered.test.ts` (new, +11)
- `backend/src/modules/marketIntelligence/tests/MarketIngestionService.test.ts` (extended with tier branch)
- `backend/src/modules/marketIntelligence/tests/cronSchedule.test.ts` (new, +5)
- `backend/src/modules/marketIntelligence/tests/CaptchaDetection.test.ts` (new, +18)

### Frontend (production)
- `frontend/vitest.config.ts` (new)
- `frontend/src/test/setup.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/realisable-value.ts` (P2.G -- `deriveIsDemo`, JSDoc fix)
- `frontend/src/features/farmerDashboard/components/MarketComparisonPage.tsx` (P2.F -- `getSourceLabel` import)

### Frontend tests
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/constants.test.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/realisable-value.test.ts` (existing + P2.G +10)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/recommendation.test.ts` (new)
- `frontend/src/features/farmerDashboard/market-intelligence/__tests__/reliability.test.ts` (new)

### Docs
- `PHASE_2_RESULTS.md` (updated to reflect P2.D completion and earlier wording reconciliation)
- `PHASE_2_DONE.md` (this file)

## 6. STOP-condition compliance

- All edits confined to the allowed scopes.
- No single change introduced more than 200 net lines outside of
  test files.
- BE `npx vitest run src/modules/marketIntelligence` -> **13 files /
  178 tests / 0 failures** (this total includes P2.D’s
  `CaptchaDetection.test.ts` and its 18 tests, committed in
  `44a5ad775`).
- FE `npm test -- --run` -> **61 tests / 0 failures**.
- Pre-existing failures in unrelated modules (Crop / Auth) are
  documented and out of scope.

---

**Phase 2 closed.** All seven items shipped on `agriseva/main`.
The next concrete work (out of PHASE 2 scope) is fixing the
pre-existing 16 BE test failures in `CropService`,
`CropController`, and `TransactionAuth` (Sentry-mock assumptions),
tracked separately.
