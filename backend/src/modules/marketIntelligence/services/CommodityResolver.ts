/**
 * CommodityResolver — maps a user-supplied commodity string to the
 * canonical names persisted in `market_prices`.
 *
 * Why this exists:
 *   Upstream Agmarknet (and eNAM) often return canonical commodity
 *   names as parenthetical disambiguations, e.g.
 *   "Bajra(Pearl Millet/Cumbu)" or "Pomegranate" stored with the
 *   local-language suffix. A farmer asking for "Bajra" must still
 *   see those real records.
 *
 * Safety rules (NO uncontrolled fuzzy matching):
 *   1. Only EXACT lowercase matches against the `commodity_alias`
 *      collection are honoured. The alias table is seeded from
 *      real past ingestion observations, never fabricated.
 *   2. The user input itself is ALWAYS a candidate. If the alias
 *      map is empty, we fall back to a single-commodity exact match.
 *   3. The resolver NEVER adds candidates that don't map from the
 *      persisted alias table.
 *
 * This class is intentionally pure (no I/O of its own) on the hot
 * path: callers pass in the pre-fetched alias map and receive a
 * candidate list. The CommodityAliasRepository method
 * `resolveCanonical()` performs the I/O.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {CommodityAliasRepository} from '../repositories/CommodityAliasRepository.js';

export interface CommodityResolverResult {
  /** Original (trimmed) input. */
  input: string;
  /** De-duplicated list of canonical candidates (input + aliases). */
  candidates: string[];
  /** True iff an alias hit added at least one extra canonical. */
  matchedAlias: boolean;
}

@injectable()
export class CommodityResolver {
  constructor(
    @inject(GLOBAL_TYPES.CommodityAliasRepository)
    private readonly aliasRepo: CommodityAliasRepository,
  ) {}

  /**
   * Resolve a user-supplied commodity string to canonical candidates.
   * Always returns at least the input itself (after trimming); never
   * returns an empty array for a non-empty input.
   */
  public async resolve(input: string | undefined | null): Promise<CommodityResolverResult> {
    const trimmed = (input ?? '').trim();
    if (!trimmed) {
      return {input: '', candidates: [], matchedAlias: false};
    }
    const candidates = await this.aliasRepo.resolveCanonical(trimmed);
    const matchedAlias =
      candidates.length > 1 ||
      (candidates.length === 1 &&
        candidates[0].toLowerCase() !== trimmed.toLowerCase());
    return {input: trimmed, candidates, matchedAlias};
  }

  /**
   * Pure helper: extract a "base" commodity name from a canonical
   * string with parenthetical disambiguation.
   *
   *   "Bajra(Pearl Millet/Cumbu)" → "Bajra"
   *   "Tomato"                   → "Tomato"
   *   "Rice(Basmati)"            → "Rice"
   *   "  Onion  "                → "Onion"
   *   "(Other)"                  → undefined  (no base to extract)
   *   ""                         → undefined
   *   undefined                  → undefined
   *
   * This is a textual extraction (not a fuzzy match). If the input
   * has no `(` or the part before `(` is empty, the trimmed input
   * is returned; if a `(` is found but the part before it is empty,
   * we return undefined so callers don't seed a no-op alias.
   */
  public static extractBaseName(canonical: string | undefined | null): string | undefined {
    if (!canonical) return undefined;
    const trimmed = canonical.trim();
    if (!trimmed) return undefined;
    const open = trimmed.indexOf('(');
    if (open < 0) return trimmed;
    const base = trimmed.slice(0, open).trim();
    if (base.length === 0) return undefined;
    return base;
  }
}
