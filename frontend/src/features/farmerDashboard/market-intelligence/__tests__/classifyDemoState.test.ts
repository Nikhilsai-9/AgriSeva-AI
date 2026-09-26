/**
 * PHASE 3 §P3.A — pure-function tests for `classifyDemoState`.
 *
 * `classifyDemoState` is the core of the DataStateBadge: it walks the
 * record list once and returns one of four states that drive the UI
 * ("Demo Data" / "Mixed" / nothing). The behaviour must never silently
 * lie about provenance — a real farmer's real record must never be
 * labelled demo, and a demo seed must never be labelled live.
 */
import {describe, it, expect} from 'vitest';
import {classifyDemoState} from '../../dataState';

describe('classifyDemoState', () => {
  it('returns "empty" for null', () => {
    expect(classifyDemoState(null)).toBe('empty');
  });

  it('returns "empty" for undefined', () => {
    expect(classifyDemoState(undefined)).toBe('empty');
  });

  it('returns "empty" for an empty array', () => {
    expect(classifyDemoState([])).toBe('empty');
  });

  it('returns "all_demo" when every record has isDemo=true', () => {
    expect(
      classifyDemoState([
        {id: 'a', isDemo: true},
        {id: 'b', isDemo: true},
      ]),
    ).toBe('all_demo');
  });

  it('returns "all_real" when every record has isDemo=false', () => {
    expect(
      classifyDemoState([
        {id: 'a', isDemo: false},
        {id: 'b', isDemo: false},
      ]),
    ).toBe('all_real');
  });

  it('returns "all_real" when isDemo is omitted (real-by-default)', () => {
    // Records from real backend writes never carry isDemo=true.
    // Treating them as real keeps the badge silent for real data.
    expect(
      classifyDemoState([
        {id: 'a'},
        {id: 'b'},
      ]),
    ).toBe('all_real');
  });

  it('returns "mixed" when some records are demo and some are real', () => {
    // This is the realistic seed-leftover scenario: the demo seed has
    // populated the catalogue, the farmer has created their own lots on
    // top, both are visible. The badge must clearly label this.
    expect(
      classifyDemoState([
        {id: 'a', isDemo: true}, // seed buyer b1
        {id: 'b', isDemo: false}, // farmer-created record
      ]),
    ).toBe('mixed');
  });

  it('treats isDemo=undefined in a list with other undefined as all_real', () => {
    expect(classifyDemoState([{id: 'a'}, {id: 'b', isDemo: false}])).toBe(
      'all_real',
    );
  });

  it('treats isDemo=undefined in a list with any isDemo=true as mixed', () => {
    expect(classifyDemoState([{id: 'a'}, {id: 'b', isDemo: true}])).toBe(
      'mixed',
    );
  });

  it('handles a single-record list correctly', () => {
    expect(classifyDemoState([{id: 'x', isDemo: true}])).toBe('all_demo');
    expect(classifyDemoState([{id: 'x', isDemo: false}])).toBe('all_real');
  });

  it('does not mutate the input list', () => {
    const items = [{id: 'a', isDemo: true}, {id: 'b', isDemo: false}];
    const before = JSON.stringify(items);
    classifyDemoState(items);
    expect(JSON.stringify(items)).toBe(before);
  });
});
