/**
 * PHASE 3 §P3.A — pure-function helper that classifies a list of records
 * by their `isDemo` flag. Extracted into its own file so it has no
 * React/Query/MSW/Zustand imports — that means it can be tested in
 * isolation without dragging in the heavy `hooks/data.ts` chain.
 *
 * The Farmer Dashboard used to show a static "Demo" badge on Buyers /
 * Payments / Storage / Logistics pages regardless of whether the
 * actual records were demo or real. That was misleading once a real
 * farmer had signed in and started creating real lots: their real
 * records were labelled demo.
 *
 * The classification uses ONLY the per-record `isDemo` flag the
 * backend already attaches to every record:
 *
 *   - "all_demo"    → every visible record has isDemo=true
 *   - "mixed"       → some real, some demo (seed leftovers + new records)
 *   - "all_real"    → every visible record has isDemo=false/undefined
 *   - "empty"       → no records to classify
 */

export type DemoDataState = "all_demo" | "mixed" | "all_real" | "empty";

export function classifyDemoState<T extends { isDemo?: boolean }>(
  items: T[] | null | undefined,
): DemoDataState {
  if (!items || items.length === 0) return "empty";
  const demoCount = items.filter((x) => x.isDemo === true).length;
  if (demoCount === items.length) return "all_demo";
  if (demoCount === 0) return "all_real";
  return "mixed";
}
