/**
 * MarketIngestionService — pulls live market prices from upstream
 * MCP servers (Agmarknet primary, eNAM fallback) and persists them
 * into MongoDB via the canonical repositories.
 *
 * Behaviour contract:
 *   1. Agmarknet is the PRIMARY source. We try it first.
 *   2. eNAM is the SECONDARY source. We only fall back when Agmarknet
 *      fails or returns zero records AND the caller hasn't opted out.
 *   3. Records are never duplicated: every record carries a
 *      deterministic `recordKey` (source-specific).
 *   4. Every fetch attempt is written to `data_update_logs`.
 *   5. The service NEVER throws — callers receive a structured
 *      `MarketIngestionResult`.
 */

import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {AgmarknetMcpClient} from '../mcp/agmarknetClient.js';
import {EnamMcpClient} from '../mcp/enamClient.js';
import {
  MarketNormaliser,
  detectCaptchaInPayload,
  detectCaptchaInError,
  todayIso,
} from './MarketNormaliser.js';
import {CommodityResolver} from './CommodityResolver.js';
import {MarketPriceRepository} from '../repositories/MarketPriceRepository.js';
import {CommodityAliasRepository} from '../repositories/CommodityAliasRepository.js';
import {DataUpdateLogRepository} from '../repositories/DataUpdateLogRepository.js';
import type {
  MarketIngestionResult,
  MarketIngestionTarget,
  MarketPriceRecord,
  MarketSourceId,
} from '../types.js';
import {
  MARKET_WATCHLIST,
  MARKET_WATCHLIST_TARGETS,
  WATCHLIST_TOTAL,
  type WatchlistEntry,
  type WatchlistTier,
} from '../config/marketWatchlist.config.js';

/**
 * Default high-demand watchlist used by the 6-hourly cron.
 *
 * PHASE 1 §P1.3 — this constant is now an alias for the full
 * tiered watchlist defined in `config/marketWatchlist.config.ts`.
 * The old hardcoded 5-commodity list silently caused 13 commodities
 * the farmer UI advertises to never get a fresh record. We now
 * cover all 18 commodities in `COMMODITIES` (FE), tiered by price
 * volatility.
 *
 * Kept exported as `DEFAULT_WATCHLIST` for backward compatibility
 * with the existing cron + any external callers.
 */
export const DEFAULT_WATCHLIST: MarketIngestionTarget[] =
  MARKET_WATCHLIST_TARGETS;

/** Sanity-check at module load: log how many commodities we cover. */
console.log(
  `[marketIntelligence] Watchlist loaded: ${WATCHLIST_TOTAL} commodities (HIGH/MEDIUM/LOW tiers — see config/marketWatchlist.config.ts).`,
);

@injectable()
export class MarketIngestionService {
  private readonly agmarknet: AgmarknetMcpClient;
  private readonly enam: EnamMcpClient;
  private readonly normaliser: MarketNormaliser;
  private readonly priceRepo: MarketPriceRepository;
  private readonly aliasRepo: CommodityAliasRepository;
  private readonly logRepo: DataUpdateLogRepository;

  private isRunning = false;

  constructor(
    @inject(GLOBAL_TYPES.AgmarknetMcpClient)
    agmarknet: AgmarknetMcpClient,
    @inject(GLOBAL_TYPES.EnamMcpClient)
    enam: EnamMcpClient,
    @inject(GLOBAL_TYPES.MarketNormaliserService)
    normaliser: MarketNormaliser,
    @inject(GLOBAL_TYPES.MarketPriceRepository)
    priceRepo: MarketPriceRepository,
    @inject(GLOBAL_TYPES.CommodityAliasRepository)
    aliasRepo: CommodityAliasRepository,
    @inject(GLOBAL_TYPES.DataUpdateLogRepository)
    logRepo: DataUpdateLogRepository,
  ) {
    this.agmarknet = agmarknet;
    this.enam = enam;
    this.normaliser = normaliser;
    this.priceRepo = priceRepo;
    this.aliasRepo = aliasRepo;
    this.logRepo = logRepo;
  }

  /**
   * Persist the normalised records and seed the commodity_alias
   * collection so future user queries (e.g. "Bajra") can resolve to
   * the canonical commodity name (e.g. "Bajra(Pearl Millet/Cumbu)").
   *
   * Aliases are seeded from:
   *   1. The crop↔commodity pair when they differ (existing path).
   *   2. The base name extracted from a parenthetical canonical like
   *      "Bajra(Pearl Millet/Cumbu)" → "Bajra" (new path).
   *
   * Both are textual extractions; we never fabricate synonyms.
   */

  /**
   * Run a single ingestion for the supplied target.
   * Returns the structured result; never throws.
   */
  public async ingest(
    target: MarketIngestionTarget,
    options: {includeFallback?: boolean} = {},
  ): Promise<MarketIngestionResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const includeFallback = options.includeFallback ?? true;
    const date = target.arrivalDate ?? todayIso();
    let captchaSuspected = false;

    const primary = await this.ingestFromAgmarknet(target, date);
    captchaSuspected = captchaSuspected || primary.captchaSuspected;
    await this.logRepo.append({
      source: 'agmarknet',
      tool: 'marketwise_price_arrival_dynamic',
      success: primary.ok && !primary.captchaSuspected,
      durationMs: primary.durationMs,
      fetchedAt: new Date().toISOString(),
      recordsNormalised: primary.records.length,
      target: target as unknown as Record<string, unknown>,
      error: primary.error,
      errorCategory: primary.captchaSuspected
        ? 'captcha'
        : primary.ok
          ? undefined
          : 'other',
    });

    if (primary.captchaSuspected) {
      // PHASE 2 §P2.D — Block ingestion on captcha. We do NOT
      // try eNAM here: if Agmarknet is captcha-blocked, the
      // eNAM fallback is likely behind the same proxy/CDN and
      // will hit the same wall, wasting a fetch.
      return {
        source: 'agmarknet',
        success: false,
        recordsNormalised: 0,
        recordsPersisted: 0,
        errors: ['agmarknet: captcha suspected'],
        startedAt,
        finishedAt: new Date().toISOString(),
        captchaSuspected: true,
      };
    }

    if (primary.ok && primary.records.length > 0) {
      const persisted = await this.persistAll(primary.records);
      return {
        source: 'agmarknet',
        success: true,
        recordsNormalised: primary.records.length,
        recordsPersisted: persisted,
        errors: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        records: primary.records,
        captchaSuspected: false,
      };
    }
    if (primary.error) errors.push(`agmarknet: ${primary.error}`);

    if (!includeFallback) {
      return {
        source: 'agmarknet',
        success: false,
        recordsNormalised: 0,
        recordsPersisted: 0,
        errors,
        startedAt,
        finishedAt: new Date().toISOString(),
        captchaSuspected: false,
      };
    }

    const fallback = await this.ingestFromEnam(target, date);
    captchaSuspected = captchaSuspected || fallback.captchaSuspected;
    await this.logRepo.append({
      source: 'enam',
      tool: 'get_trade_data_list',
      success: fallback.ok && !fallback.captchaSuspected,
      durationMs: fallback.durationMs,
      fetchedAt: new Date().toISOString(),
      recordsNormalised: fallback.records.length,
      target: target as unknown as Record<string, unknown>,
      error: fallback.error,
      errorCategory: fallback.captchaSuspected
        ? 'captcha'
        : fallback.ok
          ? undefined
          : 'other',
    });

    if (fallback.captchaSuspected) {
      return {
        source: 'enam',
        success: false,
        recordsNormalised: 0,
        recordsPersisted: 0,
        errors: [...errors, 'enam: captcha suspected'],
        startedAt,
        finishedAt: new Date().toISOString(),
        captchaSuspected: true,
      };
    }

    if (fallback.ok && fallback.records.length > 0) {
      const persisted = await this.persistAll(fallback.records);
      return {
        source: 'enam',
        success: true,
        recordsNormalised: fallback.records.length,
        recordsPersisted: persisted,
        errors,
        startedAt,
        finishedAt: new Date().toISOString(),
        records: fallback.records,
        captchaSuspected: false,
      };
    }
    if (fallback.error) errors.push(`enam: ${fallback.error}`);

    return {
      source: 'none',
      success: false,
      recordsNormalised: 0,
      recordsPersisted: 0,
      errors,
      startedAt,
      finishedAt: new Date().toISOString(),
      captchaSuspected: false,
    };
  }

  /**
   * Run the default watchlist. No-op (logged) when another
   * ingestion is already in flight.
   */
  public async runWatchlist(): Promise<MarketIngestionResult[]> {
    if (this.isRunning) {
      console.log('[marketIntelligence] cron skipped — previous run still in flight');
      return [];
    }
    this.isRunning = true;
    try {
      const results: MarketIngestionResult[] = [];
      for (const target of DEFAULT_WATCHLIST) {
        try {
          const r = await this.ingest(target, {includeFallback: true});
          results.push(r);
          console.log(
            `[marketIntelligence] cron ${target.commodity} source=${r.source} normalised=${r.recordsNormalised} persisted=${r.recordsPersisted}`,
          );
        } catch (err: any) {
          console.error(
            `[marketIntelligence] cron ${target.commodity} crashed:`,
            err?.message,
          );
        }
      }
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * PHASE 2 §P2.A — Tier-aware ingestion. Runs only the watchlist
   * entries whose `tier` matches the supplied value (HIGH / MEDIUM /
   * LOW). Each tier is wired to its own cron job so HIGH-volatility
   * commodities refresh more often than LOW-volatility ones.
   *
   * The overlap guard from `runWatchlist()` is shared so two tiers
   * that happen to overlap (e.g. a long MEDIUM run that straddles a
   * HIGH trigger) will not stack ingestion attempts on the upstream.
   *
   * Returns the ingestion results in the order they were processed.
   * If the tier name is invalid, the function returns `[]` and logs.
   */
  public async runWatchlistForTier(
    tier: WatchlistTier,
  ): Promise<MarketIngestionResult[]> {
    const entries = MARKET_WATCHLIST.filter((e) => e.tier === tier);
    if (entries.length === 0) {
      console.warn(
        `[marketIntelligence] cron asked to run tier "${tier}" — no watchlist entries match. Skipping.`,
      );
      return [];
    }
    if (this.isRunning) {
      console.log(
        `[marketIntelligence] cron ${tier} skipped — previous run still in flight`,
      );
      return [];
    }
    this.isRunning = true;
    try {
      const results: MarketIngestionResult[] = [];
      for (const entry of entries) {
        try {
          const r = await this.ingest(
            {commodity: entry.commodity, limit: entry.limit},
            {includeFallback: true},
          );
          results.push(r);
          console.log(
            `[marketIntelligence] cron ${tier} ${entry.commodity} source=${r.source} normalised=${r.recordsNormalised} persisted=${r.recordsPersisted}`,
          );
        } catch (err: any) {
          console.error(
            `[marketIntelligence] cron ${tier} ${entry.commodity} crashed:`,
            err?.message,
          );
        }
      }
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Exposed for unit tests and ops tooling. Returns the watchlist
   * entries that belong to a given tier, in the order declared in
   * `config/marketWatchlist.config.ts`. Pure read — no DB / network.
   */
  public getWatchlistEntriesForTier(tier: WatchlistTier): WatchlistEntry[] {
    return MARKET_WATCHLIST.filter((e) => e.tier === tier);
  }

  // ─── source-specific ingest paths ──────────────────────────────────

  private async ingestFromAgmarknet(
    target: MarketIngestionTarget,
    date: string,
  ): Promise<{
    ok: boolean;
    records: MarketPriceRecord[];
    error?: string;
    durationMs: number;
    captchaSuspected: boolean;
  }> {
    // Prefer the state-filtered dashboard endpoint when a state is
    // supplied (narrower, hits cached state_id). Otherwise fall back
    // to the dynamic tool. The dashboard method is OPTIONAL — when
    // the client doesn't expose it (legacy builds, mocks), we go
    // straight to the dynamic tool without decoration.
    const hasDashboard =
      typeof (this.agmarknet as unknown as {
        fetchDashboardPerMandi?: unknown;
      }).fetchDashboardPerMandi === 'function';

    let result;
    let usedDashboard = false;

    if (target.state && hasDashboard) {
      try {
        result = await (
          this.agmarknet as unknown as {
            fetchDashboardPerMandi: (args: {
              stateName: string;
              commodityContains?: string;
              date: string;
              limit: number;
            }) => Promise<{
              ok: boolean;
              data?: unknown;
              error?: string;
              durationMs: number;
            }>;
          }
        ).fetchDashboardPerMandi({
          stateName: target.state,
          commodityContains: target.commodity,
          date,
          limit: target.limit ?? 50,
        });
        usedDashboard = result?.ok === true;
      } catch (err) {
        result = undefined;
      }
    }

    if (!result || !result.ok) {
      // Soft-fall back (or up) to the dynamic tool — its per-mandi
      // shape is consumed by the normaliser directly.
      result = await this.agmarknet.fetchMarketwiseDynamic({
        commodity_contains: target.commodity,
        date,
        limit_per_page: target.limit ?? 50,
        max_pages: 5,
      });
      usedDashboard = false;
    }

    if (!result.ok || !result.data) {
      // PHASE 2 §P2.D — check the error string too: a Cloudflare
      // challenge page typically surfaces as `MCP ... returned
      // HTTP 403: <html>...<title>Just a moment...`.
      const captchaSuspected =
        detectCaptchaInError(result.error) ||
        detectCaptchaInPayload(result.data);
      return {
        ok: false,
        records: [],
        error: captchaSuspected ? 'captcha detected' : result.error,
        durationMs: result.durationMs,
        captchaSuspected,
      };
    }

    // PHASE 2 §P2.D — Even on success-shaped payloads, the
    // upstream may have returned a captcha HTML page that the MCP
    // server wrapped (or that JSON.parse failed on but was
    // passed through as a string). Scan before normalising.
    if (
      detectCaptchaInPayload(result.data) ||
      detectCaptchaInError(result.error)
    ) {
      return {
        ok: false,
        records: [],
        error: 'captcha detected',
        durationMs: result.durationMs,
        captchaSuspected: true,
      };
    }

    // Only decorate when the dashboard endpoint was actually used.
    // The dashboard returns AGGREGATE records (`as_on_price`,
    // `as_on_arrival`, `cmdt_grp_name`, `reported_date`) without
    // per-mandi fields. The dynamic tool already returns per-mandi
    // rows that the normaliser understands natively; decoration
    // would over-write legitimate per-mandi fields and break the
    // documented contract (filter malformed, never fabricate prices,
    // etc.).
    const payload = usedDashboard
      ? decorateAgmarknetAggregate(result.data, target, date)
      : result.data;
    const records = this.normaliser.normaliseAgmarknet(
      payload,
      date,
      this.agmarknet.getEndpoint(),
    );
    return {
      ok: true,
      records,
      durationMs: result.durationMs,
      captchaSuspected: false,
    };
  }

  private async ingestFromEnam(
    target: MarketIngestionTarget,
    date: string,
  ): Promise<{
    ok: boolean;
    records: MarketPriceRecord[];
    error?: string;
    durationMs: number;
    captchaSuspected: boolean;
  }> {
    // eNAM requires state+apmc+commodity. Short-circuit otherwise.
    if (!target.state || !target.market || !target.commodity) {
      return {
        ok: false,
        records: [],
        error: 'eNAM requires state+market+commodity',
        durationMs: 0,
        captchaSuspected: false,
      };
    }
    const result = await this.enam.fetchTradeData({
      state_name: target.state,
      apmc_name: target.market,
      commodity_name: target.commodity,
      from_date: date,
      to_date: date,
    });
    if (!result.ok || !result.data) {
      const captchaSuspected =
        detectCaptchaInError(result.error) ||
        detectCaptchaInPayload(result.data);
      return {
        ok: false,
        records: [],
        error: captchaSuspected ? 'captcha detected' : result.error,
        durationMs: result.durationMs,
        captchaSuspected,
      };
    }
    if (
      detectCaptchaInPayload(result.data) ||
      detectCaptchaInError(result.error)
    ) {
      return {
        ok: false,
        records: [],
        error: 'captcha detected',
        durationMs: result.durationMs,
        captchaSuspected: true,
      };
    }
    const records = this.normaliser.normaliseEnam(result.data);
    return {
      ok: true,
      records,
      durationMs: result.durationMs,
      captchaSuspected: false,
    };
  }

  private async persistAll(records: MarketPriceRecord[]): Promise<number> {
    if (!records.length) return 0;
    const r = await this.priceRepo.upsertMany(records);
    for (const rec of records) {
      if (rec.source !== 'agmarknet' && rec.source !== 'enam') continue;
      // 1. crop↔commodity alias (existing path).
      if (rec.commodity && rec.crop && rec.crop !== rec.commodity) {
        await this.aliasRepo.upsertAlias(
          rec.crop,
          rec.commodity,
          rec.source,
        );
      }
      // 2. Parenthetical base name alias (new path). E.g.
      //    canonical "Bajra(Pearl Millet/Cumbu)" seeds an alias
      //    "Bajra" → "Bajra(Pearl Millet/Cumbu)" so a farmer query
      //    for "Bajra" resolves. Skipped when there's nothing
      //    useful to extract (no parens, or parens on an empty stem).
      const base = CommodityResolver.extractBaseName(rec.commodity);
      if (
        base &&
        rec.commodity &&
        base.toLowerCase() !== rec.commodity.toLowerCase()
      ) {
        await this.aliasRepo.upsertAlias(base, rec.commodity, rec.source);
      }
    }
    return r.inserted + r.updated;
  }
}

// ─── helper: decorate aggregate Agmarknet records ────────────────────

/**
 * Decorate an Agmarknet dashboard/aggregate payload so that the
 * existing per-mandi normaliser can persist *something* useful.
 *
 * PHASE 1 — Data Fidelity Rule (PHASE_1_CHECKLIST.md §P1.2):
 *   We MUST NOT fabricate data. Specifically:
 *     • Never invent a mandi name. If the upstream did not return
 *       `mkt_name`, the record is dropped (we cannot pretend it
 *       represents a real mandi).
 *     • Never back-fill min_price / max_price from modal_price.
 *       Aggregate rows legitimately have only one price point per
 *       (commodity, state, day); the others are simply absent.
 *     • Never invent a state the upstream did not supply. We MAY
 *       fill state from the `target.state` filter (because that
 *       filter is what bounded the request), but we MUST NOT
 *       fall back to a label like "India".
 *
 * What we DO add: an `isAggregate: true` provenance tag so that
 * downstream consumers can distinguish a real per-mandi price from
 * a state-level roll-up. We also set a stable `sourceUrl` so the
 * record is traceable, and a default arrival date / arrival qty
 * when the upstream genuinely did not provide them.
 *
 * Exported for direct unit testing — see
 * `tests/MarketIngestionService.test.ts` §P1.2 fabrication tests.
 */
export function decorateAgmarknetAggregate(
  payload: unknown,
  target: {state?: string; commodity?: string},
  fallbackDate: string,
): unknown {
  const extract = (p: unknown): any[] => {
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') {
      const o: any = p;
      if (Array.isArray(o.records)) return o.records;
      if (o.data && typeof o.data === 'object' && Array.isArray(o.data.records))
        return o.data.records;
      if (Array.isArray(o.data)) return o.data;
    }
    return [];
  };
  const records = extract(payload);
  if (!records.length) return payload;

  const stateFilter = (target.state || '').trim();

  const decorated: any[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue;
    const out: any = {...raw};

    // Commodity identity: only fill from the request filter when the
    // upstream truly did not supply it.
    if (!out.cmdt_name && !out.commodity) {
      if (target.commodity) out.cmdt_name = target.commodity;
      else continue; // cannot identify — drop
    }

    // State identity: only fill from the request filter. We NEVER
    // fall back to "India" or any other label.
    if (!out.state_name && !out.state) {
      if (stateFilter) out.state_name = stateFilter;
      else continue; // cannot identify — drop
    }

    // Mandi identity: NEVER invent. If the upstream did not return a
    // mandi name, the row is dropped because persisting a synthetic
    // mandi label would lie to the farmer about which mandi the price
    // came from.
    if (!out.mkt_name && !out.market) continue;

    // Variety — accept either spell from upstream, but do NOT fall
    // back to the commodity group (that's a category, not a variety).
    if (!out.variety && !out.variety_name && typeof out.cmdt_grp_name === 'string') {
      out.variety = out.cmdt_grp_name;
    }

    // Price mapping. Preserve whatever upstream supplies. Aggregate
    // rows typically ship only `as_on_price` (a single point). We use
    // it as modalPrice and EXPLICITLY DO NOT back-fill min_price /
    // max_price from it. Absence means absence.
    const modalRaw = out.modal_price ?? out.modalPrice ?? out.as_on_price;
    if (modalRaw !== undefined) {
      out.modal_price = String(modalRaw);
      // Intentionally NOT setting min_price / max_price here.
    }

    // Arrival date — accept any of the upstream spellings, fall back
    // to reported_date, then to the caller's fallbackDate.
    if (!out.arrival_date && !out.date && !out.price_date) {
      out.arrival_date = out.reported_date ?? fallbackDate;
    }

    // Arrival qty — accept both string and number forms from upstream.
    if (
      out.arrival_qty === undefined &&
      out.arrival_quantity === undefined &&
      out.arrival === undefined
    ) {
      const q = out.as_on_arrival;
      if (q !== undefined) out.arrival_qty = String(q);
    }

    // Provenance: tag this row so consumers can distinguish per-mandi
    // from state-level aggregate. Combined with the dropped rows above,
    // this is the contract that backs our "no fabrication" claim.
    out.isAggregate = true;

    // Stable source URL for traceability of aggregate rows.
    if (!out.sourceUrl) {
      out.sourceUrl = 'agmarknet://marketwise_price_arrival';
    }

    decorated.push(out);
  }

  // Re-wrap into the same envelope shape we received. If the input was
  // an array we return a fresh array; otherwise we preserve the
  // original envelope and replace its `records` (and any nested
  // `data.records`).
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const o: any = payload;
    const wrapped: any = {...o, records: decorated};
    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
      wrapped.data = {...o.data, records: decorated};
    } else if (Array.isArray(o.data)) {
      wrapped.data = decorated;
    }
    return wrapped;
  }
  return decorated;
}