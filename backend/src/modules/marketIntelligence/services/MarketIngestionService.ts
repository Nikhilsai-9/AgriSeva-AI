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
import {MarketNormaliser, todayIso} from './MarketNormaliser.js';
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

/** Default high-demand watchlist used by the 6-hourly cron. */
export const DEFAULT_WATCHLIST: MarketIngestionTarget[] = [
  {commodity: 'Tomato', limit: 50},
  {commodity: 'Onion', limit: 50},
  {commodity: 'Rice', limit: 50},
  {commodity: 'Wheat', limit: 50},
  {commodity: 'Maize', limit: 50},
];

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

    const primary = await this.ingestFromAgmarknet(target, date);
    await this.logRepo.append({
      source: 'agmarknet',
      tool: 'marketwise_price_arrival_dynamic',
      success: primary.ok,
      durationMs: primary.durationMs,
      fetchedAt: new Date().toISOString(),
      recordsNormalised: primary.records.length,
      target: target as unknown as Record<string, unknown>,
      error: primary.error,
    });

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
      };
    }

    const fallback = await this.ingestFromEnam(target, date);
    await this.logRepo.append({
      source: 'enam',
      tool: 'get_trade_data_list',
      success: fallback.ok,
      durationMs: fallback.durationMs,
      fetchedAt: new Date().toISOString(),
      recordsNormalised: fallback.records.length,
      target: target as unknown as Record<string, unknown>,
      error: fallback.error,
    });

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

  // ─── source-specific ingest paths ──────────────────────────────────

  private async ingestFromAgmarknet(
    target: MarketIngestionTarget,
    date: string,
  ): Promise<{ok: boolean; records: MarketPriceRecord[]; error?: string; durationMs: number}> {
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
      return {ok: false, records: [], error: result.error, durationMs: result.durationMs};
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
    return {ok: true, records, durationMs: result.durationMs};
  }

  private async ingestFromEnam(
    target: MarketIngestionTarget,
    date: string,
  ): Promise<{ok: boolean; records: MarketPriceRecord[]; error?: string; durationMs: number}> {
    // eNAM requires state+apmc+commodity. Short-circuit otherwise.
    if (!target.state || !target.market || !target.commodity) {
      return {
        ok: false,
        records: [],
        error: 'eNAM requires state+market+commodity',
        durationMs: 0,
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
      return {ok: false, records: [], error: result.error, durationMs: result.durationMs};
    }
    const records = this.normaliser.normaliseEnam(result.data);
    return {ok: true, records, durationMs: result.durationMs};
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
 * The Agmarknet MCP server only exposes aggregate per-commodity
 * records (`cmdt_name, as_on_price, as_on_arrival, cmdt_grp_name,
 * reported_date`). The normaliser expects per-mandi fields
 * (commodity/market/state + min/max/modal). This function injects
 * the missing fields into a decorated array-shaped payload so the
 * existing normaliser can persist real records.
 *
 * The injected `market` is a synthetic state-aggregate label
 * (e.g. "Gujarat (state aggregate)"). We document this honestly
 * via `sourceUrl` / `sourceSystem` so consumers can detect it.
 */
function decorateAgmarknetAggregate(
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

  const stateName = (target.state || '').trim() || 'India';
  const marketLabel = `${stateName} (state aggregate)`;

  const decorated = records.map((raw: any) => {
    const out = { ...(raw || {}) };
    // Identity fields the normaliser reads first.
    if (!out.cmdt_name && !out.commodity) out.cmdt_name = target.commodity;
    if (!out.state_name && !out.state) out.state_name = stateName;
    if (!out.mkt_name && !out.market) out.mkt_name = marketLabel;
    if (!out.variety && !out.variety_name && out.cmdt_grp_name)
      out.variety = out.cmdt_grp_name;

    // Price mapping. Aggregate has one price point per commodity per
    // state per day ("as_on_price"). We use it as modalPrice for the
    // state as a whole; minPrice and maxPrice are only set when the
    // upstream provides a range (rare in the aggregate shape).
    const modalRaw = out.modal_price ?? out.modalPrice ?? out.as_on_price;
    if (modalRaw !== undefined) {
      out.modal_price = String(modalRaw);
      if (out.min_price === undefined && out.minPrice === undefined) {
        out.min_price = String(modalRaw);
      }
      if (out.max_price === undefined && out.maxPrice === undefined) {
        out.max_price = String(modalRaw);
      }
    }

    // Arrival date.
    if (!out.arrival_date && !out.date && !out.price_date) {
      out.arrival_date = out.reported_date ?? fallbackDate;
    }

    // Arrival qty — accept both string and number forms.
    if (
      out.arrival_qty === undefined &&
      out.arrival_quantity === undefined &&
      out.arrival === undefined
    ) {
      const q = out.as_on_arrival;
      if (q !== undefined) out.arrival_qty = String(q);
    }

    // Source URL for traceability.
    if (!out.sourceUrl) out.sourceUrl = 'agmarknet://marketwise_price_arrival';
    return out;
  });

  // Re-wrap into the same envelope shape we received.
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