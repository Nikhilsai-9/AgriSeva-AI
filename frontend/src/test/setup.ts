/**
 * PHASE 2 §P2.B — Vitest global setup.
 *
 * Runs once per test file. Imports the jest-dom matchers so React-Component
 * tests can use `expect(...).toBeInTheDocument()` etc.
 *
 * Intentionally minimal — we do NOT spin up MSW or fetch mocks globally;
 * those belong to the individual test that needs them (most market-
 * intelligence tests are pure functions and don't touch the network).
 */
import '@testing-library/jest-dom/vitest';
