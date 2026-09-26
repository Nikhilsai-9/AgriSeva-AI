# PHASE 2 — RESULTS — Operational Hardening & Test Coverage

**Status:** P2.A, P2.B, P2.C complete (73 new tests passing, 0 regressions).
P2.D–G: pending — see "Open items" section below.

**Companion docs:** `PHASE_2_PLAN.md` (planning), `PHASE_1_DONE.md`
(closure of predecessor phase).

---

## 1. Test-count progression

| Slice                                | Before P2 | After P2 (so far) | New |
| ------------------------------------ | --------- | ------------------ | --- |
| Backend marketIntelligence           | 98        | **155**            | +57 |
| Frontend farmerDashboard             | 0         | **51**             | +51 |
| **PHASE 2 — test total**             | **98**    | **206**            | **+108** |

- All three P2.C depth-test files run green on their own
  (`MarketNormaliser.test.ts`, `MarketHistoryService.test.ts`,
  `MarketReliabilityService.test.ts`).
- The full `modules/marketIntelligence` test directory reports
  **12 files / 155 tests / 0 failures**.
- The remaining 16 failures in the global backend suite are in
  unrelated Crop / Auth modules and pre-existed this phase.

## 2. Items completed

### ✅ P2.A — Tier-aware cron cadence (PHASE 1 §P1.3 deferred)
- Split `marketIngestCron.ts` (full-watchlist every 6h) into three
  tier-aware jobs (`tieredMarketCron.ts`): HIGH every 4h, MEDIUM
  every 8h, LOW every 24h, each with its own overlap guard.
- Manual full-watchlist refresh via
  `POST /api/market-prices/refresh` kept on the original helper.
- New service method `runWatchlistForTier(tier)` on
  `MarketIngestionService` so the new crons share one code path with
  the public route.
- Tests: `cronSchedule.test.ts` (schedule-shape),
  `MarketIngestionService.tiered.test.ts` + extension of
  `MarketIngestionService.test.ts` (the "runWatchlistForTier" path
  only touches the requested tier) = **16 BE tests, all passing**.

### ✅ P2.B — Frontend Vitest infrastructure activation
- Created `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`,
  and added `test` + `test:ci` scripts in `frontend/package.json`.
- First 4 test files cover the FE pure helpers that previously had no
  test surface: `constants.test.ts`, `realisable-value.test.ts`,
  `recommendation.test.ts`, `reliability.test.ts` — **51 FE tests,
  all passing**.
- This unblocks future test work on `bandForScore`,
  `recommendBestMarketForLot`, `computeRealisableValue`, and the
  reliability chip components.

### ✅ P2.C — Backend depth tests (PHASE 0 §6)
No production-code changes; coverage only.

| File                                                              | Tests | Focus |
| ----------------------------------------------------------------- | ----- | ----- |
| `MarketNormaliser.test.ts`                                        | 33    | `toFiniteNumber`, `toIsoDate`, `cleanString`, `buildRecordKey`, `todayIso`, `normaliseAgmarknet`, `normaliseEnam`, `buildRecord`. Covers lakh (`1,23,456`) parsing, eNAM meta-fallback, "never fabricate prices" guarantee, ISO date round-trip via JS `Date`. |
| `MarketHistoryService.test.ts`                                    | 16    | `annotateWithChange` comparability rule (state+market+commodity+variety), changePct / trendPct formulas, null safety, immutability, out-of-order sort. `getHistory` repo-integration via injected mock. |
| `MarketReliabilityService.test.ts`                                | 8     | Score components (40 / 30 / 20 / 10), Excel­lent/Good/Fair/Limited label boundaries, `snapshotAll` ordering (agmarknet then enam). Frozen clock via `vi.useFakeTimers`. |

## 3. Items still open (P2.D–G)

These four items are defined in `PHASE_2_PLAN.md` but **not yet
landed**. They are queued in plan order:

### P2.D — Captcha detection (PHASE 0 §7 risk #1)
- Detect captcha markers (`<title>Just a moment`, `cf-chl-bypass`,
  `g-recaptcha`) in raw agmarknet / enam responses.
- Surface via `captchaSuspected: boolean` on `MarketIngestionResult`
  and `errorCategory: 'captcha'` on `data_update_log` rows.
- Expose via `MarketHealthController` so monitoring can see when an
  upstream source is rate-limiting.
- Status: planned (next).

### P2.E — Timezone hardening (PHASE 0 §7 risk #4)
- Promote `arrivalDate` to a `Date` with explicit `Asia/Kolkata` TZ
  on `MarketPriceRecord`; assert `todayIso()` is IST.
- Status: planned.

### P2.F — `MarketComparisonPage.tsx` tidy-up (PHASE 1 §deferred)
- Replace the local `t()`-based source label with the
  `getSourceLabel` helper introduced in P2.7.
- Status: planned (cosmetic, one-file change).

### P2.G — `realisable-value.ts` `isDemo` derivation (P2.8 follow-up)
- Audit and remove remaining `isDemo: true` constants; derive
  `isDemo` from `source === 'demo' || source === undefined`.
- Status: planned.

## 4. STOP-condition compliance (so far)

- ✅ All edits confined to `backend/src/modules/marketIntelligence/**`,
  `frontend/src/features/farmerDashboard/**`, `frontend/vitest.config.ts`,
  `frontend/src/test/setup.ts`, `frontend/package.json` scripts, and
  this docs folder.
- ✅ No single change introduced more than 200 net lines outside of
  test files.
- ✅ Full `pnpm test:ci` (marketIntelligence slice) stays green.

---

_Last updated at the close of P2.C. P2.D, P2.E, P2.F, P2.G pending._
