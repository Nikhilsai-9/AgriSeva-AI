/**
 * Server-side guard for demo data seeding in the transaction module.
 *
 * BACKGROUND
 * ──────────
 * The transaction module ships with a `SeedLoader` that, on first
 * access from any controller, idempotently inserts a fixed catalog of
 * *fictional* demo records:
 *
 *   • 12 demo buyers   (DEMO_BUYERS)
 *   •  4 demo storage options (DEMO_STORAGE_OPTIONS)
 *   •  4 demo logistics options (DEMO_LOGISTICS_OPTIONS)
 *   •  2 demo payment journal entries (DEMO_PAYMENTS)
 *   •  4 demo lots / 4 demo offers / 2 demo grievances
 *
 * Every seeded row is tagged `isDemo: true` so the frontend can badge
 * it as "Demo Data". The `isDemo` propagation is wired through the
 * controllers' JSON responses and rendered by `<DataStateBadge />`.
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * The catalog is useful for local development and demo environments
 * but MUST NEVER be silently inserted into a production database.
 * A production environment serving real farmers must surface honest
 * empty states ("no buyers found", "no logistics quotes available",
 * "no payment history") until real data is wired in.
 *
 * This module owns the single source of truth for that decision. It
 * reads ONLY backend server-side environment variables. It does NOT
 * read `VITE_ENABLE_MOCKS`, which is a frontend build-time flag that
 * controls MSW interceptors in the browser. A browser-supplied flag
 * MUST NOT influence whether the backend writes to MongoDB.
 *
 * DECISION RULE
 * ─────────────
 *   • Default (no env var set)                       → DISABLED
 *   • ENABLE_DEMO_SEEDING=true  (or =1)              → ENABLED
 *   • ENABLE_DEMO_SEEDING=false (or =0 or anything)  → DISABLED
 *   • VITE_ENABLE_MOCKS=...                          → IGNORED
 *
 * Production Firebase Functions deployments must NOT set
 * `ENABLE_DEMO_SEEDING`. Local development sets it explicitly in
 * `.env.development`.
 */

import { env } from '#root/utils/env.js';

export interface DemoSeedingDecision {
  /** Whether the backend is permitted to seed demo data. */
  enabled: boolean;
  /** Origin of the decision, for diagnostic logging. */
  source:
    | 'env:ENABLE_DEMO_SEEDING=true'
    | 'env:ENABLE_DEMO_SEEDING!=true'
    | 'default-off';
}

let cached: DemoSeedingDecision | null = null;

/**
 * Returns the demo-seeding decision, evaluating it once per process.
 *
 * The decision is cached at module load so the env file is parsed a
 * single time. Tests that need to flip the flag between scenarios
 * must call {@link _resetDemoSeedingDecision}.
 */
export function getDemoSeedingDecision(): DemoSeedingDecision {
  if (cached) return cached;
  const raw = env('ENABLE_DEMO_SEEDING');
  if (raw == null) {
    cached = { enabled: false, source: 'default-off' };
  } else {
    const enabled = raw === 'true' || raw === '1';
    cached = {
      enabled,
      source: enabled
        ? 'env:ENABLE_DEMO_SEEDING=true'
        : 'env:ENABLE_DEMO_SEEDING!=true',
    };
  }
  return cached;
}

/**
 * Convenience predicate used by `SeedLoader.ensureSeeded()`.
 */
export function isDemoSeedingEnabled(): boolean {
  return getDemoSeedingDecision().enabled;
}

/**
 * Test-only helper: drops the cached decision so the next call to
 * {@link getDemoSeedingDecision} re-reads `process.env`.
 *
 * Not part of the public API. Do NOT call from production code.
 */
export function _resetDemoSeedingDecision(): void {
  cached = null;
}
