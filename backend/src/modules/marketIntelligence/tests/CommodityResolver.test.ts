/**
 * Unit tests for CommodityResolver.
 *
 * These tests pin the safety contract documented on the resolver:
 *   - Exact-match only (no fuzzy / substring / regex matching).
 *   - Input is always a candidate.
 *   - Alias lookups return only canonical names from the alias map.
 *   - `extractBaseName` is a pure textual transformation.
 */

import 'reflect-metadata';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {CommodityResolver} from '../services/CommodityResolver.js';
import type {CommodityAliasRepository} from '../repositories/CommodityAliasRepository.js';

describe('CommodityResolver', () => {
  let aliasRepo: {
    findByAlias: ReturnType<typeof vi.fn>;
    resolveCanonical: ReturnType<typeof vi.fn>;
    upsertAlias: ReturnType<typeof vi.fn>;
  };
  let resolver: CommodityResolver;

  beforeEach(() => {
    aliasRepo = {
      findByAlias: vi.fn(),
      resolveCanonical: vi.fn(),
      upsertAlias: vi.fn(),
    };
    resolver = new CommodityResolver(
      aliasRepo as unknown as CommodityAliasRepository,
    );
  });

  describe('extractBaseName (pure helper)', () => {
    it('strips parenthetical disambiguation', () => {
      expect(
        CommodityResolver.extractBaseName('Bajra(Pearl Millet/Cumbu)'),
      ).toBe('Bajra');
    });

    it('returns the input unchanged when there is no parens', () => {
      expect(CommodityResolver.extractBaseName('Tomato')).toBe('Tomato');
    });

    it('returns undefined when only the parens part is non-empty', () => {
      expect(CommodityResolver.extractBaseName('(Other)')).toBeUndefined();
    });

    it('handles whitespace gracefully', () => {
      expect(CommodityResolver.extractBaseName('  Onion  ')).toBe('Onion');
      expect(
        CommodityResolver.extractBaseName('  Rice(Basmati)  '),
      ).toBe('Rice');
    });

    it('returns undefined for empty / nullish input', () => {
      expect(CommodityResolver.extractBaseName(undefined)).toBeUndefined();
      expect(CommodityResolver.extractBaseName(null)).toBeUndefined();
      expect(CommodityResolver.extractBaseName('')).toBeUndefined();
      expect(CommodityResolver.extractBaseName('   ')).toBeUndefined();
    });
  });

  describe('resolve()', () => {
    it('returns the input itself when the alias map has no entry', async () => {
      aliasRepo.resolveCanonical.mockResolvedValueOnce(['Bajra']);
      const out = await resolver.resolve('Bajra');
      expect(out.input).toBe('Bajra');
      expect(out.candidates).toEqual(['Bajra']);
      expect(out.matchedAlias).toBe(false);
    });

    it('returns input + canonical when the alias map has a hit', async () => {
      aliasRepo.resolveCanonical.mockResolvedValueOnce([
        'Bajra',
        'Bajra(Pearl Millet/Cumbu)',
      ]);
      const out = await resolver.resolve('Bajra');
      expect(out.input).toBe('Bajra');
      expect(out.candidates).toEqual([
        'Bajra',
        'Bajra(Pearl Millet/Cumbu)',
      ]);
      expect(out.matchedAlias).toBe(true);
    });

    it('handles unknown commodity without inventing aliases', async () => {
      aliasRepo.resolveCanonical.mockResolvedValueOnce(['Sorghum']);
      const out = await resolver.resolve('Sorghum');
      expect(out.candidates).toEqual(['Sorghum']);
      expect(out.matchedAlias).toBe(false);
    });

    it('returns empty result for empty / whitespace input', async () => {
      const out = await resolver.resolve('   ');
      expect(out.input).toBe('');
      expect(out.candidates).toEqual([]);
      expect(out.matchedAlias).toBe(false);
      expect(aliasRepo.resolveCanonical).not.toHaveBeenCalled();
    });

    it('returns empty result for undefined input without I/O', async () => {
      const out = await resolver.resolve(undefined);
      expect(out.candidates).toEqual([]);
      expect(aliasRepo.resolveCanonical).not.toHaveBeenCalled();
    });

    it('does not return unrelated commodities via accidental match', async () => {
      aliasRepo.resolveCanonical.mockImplementationOnce(async (s: string) => {
        if (s.toLowerCase() === 'bajra') {
          return ['Bajra', 'Bajra(Pearl Millet/Cumbu)'];
        }
        return [s];
      });
      const out = await resolver.resolve('Bajra');
      expect(out.candidates).toHaveLength(2);
      expect(out.candidates.every(c => /bajra/i.test(c))).toBe(true);
    });
  });
});
