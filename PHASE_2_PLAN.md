# PHASE 2 — Operational Hardening & Test Coverage — PLAN

**Status:** Active.
**Predecessor:** PHASE 1 (Market Intelligence 2.0 — closed). PHASE 0 (read-only audit) §6, §7.
**Goal:** Operational hardening (cron cadence, timezone, captcha) + activate frontend test infrastructure + deepen backend test coverage on pure helpers.

> **Out of scope:** Credential-driven deployment work (DEPLOYMENT_READINESS.md Phase 2). Deferred analytics / ML (P4). Cloud Run job migration.

---

## 1. Items

### P2.A — Tier-aware cron cadence (PHASE 1 §P1.3 deferred)
- **Problem:** `marketIngestCron.ts` runs every 6h and ingests the full watchlist (18 commodities) at once. The tier file (`marketWatchlist.config.ts`) documents per-tier `refreshHours` (4 / 8 / 12 / 24) but the cron doesn't read it.
- **Fix:** Split ingestion into three jobs (HIGH / MEDIUM / LOW), each with its own cron schedule and overlap guard. Keep `runWatchlist()` for manual `/api/market-prices/refresh`. Add `runWatchlistForTier(tier)` on `MarketIngestionService`.
- **Tests:** `cronSchedule.test.ts` (offsets) + `MarketIngestionService.tiered.test.ts` (only HIGH in HIGH call).
- **Files:** split `marketIngestCron.ts` into High/Medium/Low variants; new test files.

### P2.B — Frontend Vitest infrastructure activation (PHASE 36)
- **Problem:** `frontend/package.json` has `vitest`, `@testing-library/react`, `jsdom`, `msw` installed but no `vitest.config.ts` exists. PHASE 1's `bandForScore` and other pure helpers cannot be unit-tested.
- **Fix:** Create `frontend/vitest.config.ts` + `frontend/src/test/setup.ts`. Add scripts. First test files: `bandForScore`, `recommendBestMarketForLot`, `computeRealisableValue`, `MarketReliabilityChip`.
- **Tests:** ≥ 30 assertions across 4 files.
- **Files:** `frontend/vitest.config.ts` (new); `frontend/src/test/setup.ts` (new); 4 new test files; `frontend/package.json` scripts.

### P2.C — Backend depth tests (PHASE 0 §6)
- **Problem:** `MarketNormaliser`, `MarketHistoryService`, `MarketReliabilityService` are pure helpers with edge cases (malformed payloads, prev=null, prev.modal=0, missing variety, edge-score bands) that aren't unit-tested.
- **Fix:** Three focused unit-test files. No new logic — just coverage.
- **Tests:** ≥ 25 assertions across 3 files.
- **Files:** new `MarketNormaliser.test.ts`, `MarketHistoryService.test.ts`, `MarketReliabilityService.test.ts`.

### P2.D — Captcha detection (PHASE 0 §7 risk #1)
- **Problem:** Agmarknet returns HTML captcha pages when rate-limited. `MarketNormaliser` silently returns `[]`. No alerting.
- **Fix:** Detect captcha markers (`<title>Just a moment`, `cf-chl-bypass`, `g-recaptcha`) in raw responses. Add `captchaSuspected: boolean` to `MarketIngestionResult`. Persist `data_update_log` row with `errorCategory: 'captcha'`. Surface via `MarketHealthController`.
- **Tests:** ≥ 6 assertions.
- **Files:** `MarketNormaliser.ts`, `MarketIngestionService.ts`, `types.ts`, `ReliabilityService.ts`, `MarketHealthController.ts`, new test file.

### P2.E — Timezone hardening (PHASE 0 §7 risk #4)
- **Problem:** Records carry ISO dates without explicit timezone. `arrival_date` is YYYY-MM-DD local IST; UI does `Date.parse(iso)` with no TZ conversion.
- **Fix:** Store `arrivalDate` as Date with explicit `Asia/Kolkata` TZ and a `timezone: 'Asia/Kolkata'` field on `MarketPriceRecord`. `todayIso()` asserts IST.
- **Tests:** ≥ 5 assertions.
- **Files:** `MarketNormaliser.ts`, `types.ts`, new test file.

### P2.F — `MarketComparisonPage.tsx` tidy-up (PHASE 1 §deferred)
- **Problem:** P2.7 added `getSourceLabel` helper; `MarketComparisonPage.tsx` still uses its local `t()` call. Cosmetic.
- **Fix:** Switch to `getSourceLabel`.
- **Files:** `MarketComparisonPage.tsx`.

### P2.G — `realisable-value.ts` `isDemo` derivation (P2.8 follow-up)
- **Problem:** P2.8 partial — `isDemo` may still need wiring at remaining call sites.
- **Fix:** Audit all hardcoded `isDemo: true`; replace with `source === 'demo' || source === undefined`.
- **Files:** `realisable-value.ts` + callers.

---

## 2. Scope discipline

- **Backend:** Edit `backend/src/modules/marketIntelligence/**` ONLY. No cross-module changes.
- **Frontend:** Edit `frontend/src/features/farmerDashboard/**` + create `frontend/vitest.config.ts` + `frontend/src/test/setup.ts`. No cross-feature changes.
- **Docs:** Add `PHASE_2_PLAN.md`, `PHASE_2_RESULTS.md`, `PHASE_2_DONE.md`. Update `PHASE_1_DONE.md` "Phase 2+" pointer.

---

## 3. Test discipline

- Backend: `cd backend && pnpm test:ci` (vitest) after every backend change.
- Frontend: `cd frontend && pnpm test` (vitest) — first ever invocation must pass.
- Frontend type-check: `cd frontend && pnpm tsc --noEmit` after every FE change.

---

## 4. Git discipline

- One focused commit per logical group (P2.A → P2.G).
- Never commit unrelated modified files in the working tree.
- No force-push; no rebases of `main`.

---

## 5. STOP conditions

- Any single item touches code outside `marketIntelligence/` or `farmerDashboard/`.
- Any single change introduces more than 200 net lines outside of test files.
- `pnpm test:ci` (BE) or `pnpm test` (FE) fails for a non-trivial reason after a change.
- Cron expressions would collide (HIGH/MEDIUM/LOW hitting the same minute).
