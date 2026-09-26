# PHASE 2 — RESULTS — Operational Hardening & Test Coverage

**Status:** All seven items shipped (P2.A, P2.B, P2.C, P2.D, P2.E,
P2.F, P2.G) — **+141 new tests passing, 0 regressions**.
P2.D (captcha detection) was committed in `44a5ad775` and its 18 BE
tests were already counted in the BE total below; the earlier "P2.D
deferred to PHASE 3" wording in this doc was written without
noticing P2.D had landed, and has been corrected.

**Companion docs:** `PHASE_2_PLAN.md` (planning), `PHASE_1_DONE.md`
(closure of predecessor phase), `PHASE_2_DONE.md` (closure summary).

---

## 1. Test-count progression

| Slice                                | Before P2 | After P2 (final) | New |
| ------------------------------------ | --------- | ---------------- | --- |
| Backend marketIntelligence           | 98        | **178**          | +80 |
| Frontend farmerDashboard             | 0         | **61**           | +61 |
| **PHASE 2 — test total**             | **98**    | **239**          | **+141** |

- All three P2.C depth-test files run green on their own
  (`MarketNormaliser.test.ts`, `MarketHistoryService.test.ts`,
  `MarketReliabilityService.test.ts`).
- The full `modules/marketIntelligence` test directory reports
  **13 files / 178 tests / 0 failures**.
- FE `npm test -- --run` reports **61 tests / 0 failures**.
- The remaining failures in the global backend suite are in
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
  `recommendation.test.ts`, `reliability.test.ts`.
- This unblocks future test work on `bandForScore`,
  `recommendBestMarketForLot`, `computeRealisableValue`, and the
  reliability chip components.
- **51 FE tests added in this slice.**

### ✅ P2.C — Backend depth tests (PHASE 0 §6)
No production-code changes; coverage only.

| File                                                          | Tests | Focus |
| ------------------------------------------------------------- | ----- | ----- |
| `MarketNormaliser.test.ts`                                    | 33 → **38** (+5 IST) | `toFiniteNumber`, `toIsoDate`, `cleanString`, `buildRecordKey`, `todayIso`, `normaliseAgmarknet`, `normaliseEnam`, `buildRecord`. Covers lakh (`1,23,456`) parsing, eNAM meta-fallback, "never fabricate prices" guarantee, ISO date round-trip via JS `Date`. **P2.E adds:** late-UTC rolls into next IST day, mid-IST stays same day, zero-padding, `todayIso()`/`Intl` agreement across 3 instants, `buildRecord` stamps `timezone`. |
| `MarketHistoryService.test.ts`                                | 16    | `annotateWithChange` comparability rule (state+market+commodity+variety), changePct / trendPct formulas, null safety, immutability, out-of-order sort. `getHistory` repo-integration via injected mock. |
| `MarketReliabilityService.test.ts`                            | 8     | Score components (40 / 30 / 20 / 10), Excellent/Good/Fair/Limited label boundaries, `snapshotAll` ordering (agmarknet then enam). Frozen clock via `vi.useFakeTimers`. |

### ✅ P2.D — Captcha / challenge-page detection (PHASE 0 §7 risk #1)
- Detects captcha markers in agmarknet / eNAM raw responses
  (Cloudflare "Just a moment", `cf-chl-bypass`, `g-recaptcha`).
  Helpers in `MarketNormaliser.ts`: `CAPTCHA_MARKERS`,
  `detectCaptchaInString`, `detectCaptchaInPayload`,
  `detectCaptchaInError` (case-insensitive, never throw, handle
  circular objects safely).
- `MarketIngestionService` runs captcha detection on **both**
  `result.data` and `result.error` before normalising / persisting.
  When a captcha is detected, the ingestion short-circuits with
  `captchaSuspected: true`, records 0 normalisations, and writes a
  `data_update_log` row with `errorCategory: 'captcha'`.
- `DataUpdateLogRepository` gains `captchaIncidentsLast24h(sourceId)`.
- `MarketReliabilityService.snapshot()` rolls captcha incidents into
  the 24h window and surfaces them as a `reasons` entry — captcha is
  intentionally NOT folded into the score, since it signals upstream
  rate-limiting rather than a defect in our code.
- `MarketHealthController.health()` exposes `captchaSuspected: boolean`
  aggregated across both sources so monitoring can detect upstream
  rate-limiting without scraping the full snapshots.
- **+18 new BE tests** in `CaptchaDetection.test.ts`. Covers positive
  matches (each marker), negative matches (legitimate HTML, JSON,
  empty input), payload vs error paths, case-insensitivity, and the
  never-throw / circular-object contract.
- Commit: `44a5ad775 [phase2] p2.d: captcha / challenge-page
  detection in MarketNormaliser`.

### ✅ P2.E — Timezone hardening (PHASE 0 §7 risk #4)
- `todayIso()` in `MarketNormaliser.ts` now returns IST
  (Asia/Kolkata) via the new `formatIstDate()` helper backed by
  `Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata'})`.
- Added `timezone?: 'Asia/Kolkata'` field to `MarketPriceRecord`
  in `types.ts` (with JSDoc explaining the IST anchor and the
  18:30–24:00 UTC boundary case).
- `buildRecord()` stamps `timezone: 'Asia/Kolkata'` on every
  record, and the `arrivalDate` JSDoc flags it as the IST calendar
  date, not UTC.
- Backward-compat decision: kept the `todayIso()` name; updated
  the one existing test that compared against UTC. **+5 new BE
  tests, all passing.**

### ✅ P2.F — `MarketComparisonPage.tsx` tidy-up (PHASE 1 §deferred)
- Removed unused `sourceLabel` import; added `getSourceLabel`
  import from `@/features/farmerDashboard/market-intelligence`.
- Replaced the 5-branch inline ternary `sourceLabelText` with:
  - Multi-source custom case ("Agmarknet + eNAM") kept inline
    with an explanatory comment (the helper is single-source by
    contract).
  - Single-source case routed through `getSourceLabel(sourcesInUse[0], isDemo)`.
- Cosmetic only. **51/51 FE tests still pass** (no new tests
  needed — covered by import wiring and visual review).

### ✅ P2.G — `realisable-value.ts` `isDemo` derivation (P2.8 follow-up)
- Audited all `isDemo: true` / `isDemo: false` literal sites in
  `frontend/src/features/farmerDashboard/**`. Found one price-level
  hardcode at `realisable-value.ts:140` that silently flagged every
  computed value as demo regardless of source.
- Removed the hardcode. Introduced a single helper `deriveIsDemo(price)`
  that returns `true` iff `price.source === 'demo'` or source is
  missing/null/undefined (legacy fixture safety).
- `computeRealisableValue` now returns `isDemo: deriveIsDemo(price)`.
- Updated the misleading JSDoc ("Always true in this build") on
  `RealisableValue.isDemo` to a precise description of the new
  derivation rule.
- **+10 new FE tests**: agmarknet, enam, demo, uppercase DEMO,
  missing source, null/undefined price, plus the four corresponding
  `computeRealisableValue` `isDemo` outputs. **61/61 FE tests pass**
  (was 51 → +10).

## 3. STOP-condition compliance

- ✅ All edits confined to `backend/src/modules/marketIntelligence/**`,
  `frontend/src/features/farmerDashboard/**`, `frontend/vitest.config.ts`,
  `frontend/src/test/setup.ts`, `frontend/package.json` scripts, and
  this docs folder.
- ✅ No single change introduced more than 200 net lines outside of
  test files.
- ✅ Full `npx vitest run src/modules/marketIntelligence` reports
  **13 files / 178 tests / 0 failures** (this total includes P2.D's
  `CaptchaDetection.test.ts` and its 18 tests, committed in
  `44a5ad775`).
- ✅ Full `npm test -- --run` (frontend) reports **61 tests / 0 failures**.

---

_Last updated at the close of P2.D (commit `44a5ad775`). All seven
items shipped; no items deferred from PHASE 2._
