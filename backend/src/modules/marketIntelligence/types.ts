/**
 * Market Intelligence — shared types & interfaces
 *
 * The single canonical MarketPrice shape persisted in `market_prices`.
 * Source-specific shapes are mapped onto this in MarketNormaliser.
 *
 * Status semantics:
 *   LIVE     — record came from a successful upstream MCP call
 *              (Agmarknet or eNAM) and was normalised.
 *   DEMO     — record was synthesised by a fallback path or test.
 *   FUTURE   — fields that downstream consumers may show but that
 *              are not yet populated (coordinates, demand score, etc.).
 */

export type MarketSourceId = 'agmarknet' | 'enam' | 'demo';

export type MarketPriceStatus = 'live' | 'demo' | 'stale';

export interface MarketPriceRecord {
  /** Deterministic record key, see MarketNormaliser.buildRecordKey. */
  recordKey: string;
  source: MarketSourceId;
  /** Human-readable upstream label (e.g. "Agmarknet", "eNAM"). */
  sourceSystem: string;
  /** Optional upstream URL the record was lifted from. */
  sourceUrl?: string;

  commodity: string;
  /** Optional commodity group (e.g. "Vegetables"). */
  commodityGroup?: string;
  crop: string;
  variety?: string;
  grade?: string;

  market: string;
  district?: string;
  state: string;

  minPrice?: number;
  maxPrice?: number;
  modalPrice?: number;
  unit: string;

  /** ISO date (YYYY-MM-DD) the price was reported for. */
  arrivalDate: string;
  /** When the upstream reported it (ISO timestamp). */
  reportedAt?: string;
  /** When we ingested this record into Mongo. */
  ingestedAt: string;

  /** Change vs previous session, percent. Only set when a previous
   *  comparable observation exists; null when not computable. */
  changePct?: number | null;
  /** 7-day rolling trend (percent). Optional. */
  trendPct?: number | null;

  /** Arrival quantity in quintals/tonnes depending on `unit`. */
  arrivalQty?: number;

  /** When coordinates are known. */
  mandiLat?: number;
  mandiLon?: number;

  /** Provenance / fetch context. */
  fetchStatus: MarketPriceStatus;
  fetchError?: string;

  /**
   * TRUE when this record was synthesised from an Agmarknet dashboard
   * *aggregate* response (e.g. `get_dashboard_data` for a state without
   * per-mandi granularity). Aggregate rows MUST NOT be confused with
   * per-mandi rows in dashboards: they represent a state-level roll-up,
   * not a specific mandi. Consumers can suppress aggregates, surface
   * them with a badge, or downgrade their confidence — but they must
   * not silently render them as if they were a real mandi price.
   */
  isAggregate?: boolean;
}

export interface MarketIngestionTarget {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  /** ISO date YYYY-MM-DD. Defaults to today. */
  arrivalDate?: string;
  /** Max records to request upstream. Defaults to 50. */
  limit?: number;
}

export interface MarketIngestionResult {
  source: MarketSourceId | 'none';
  success: boolean;
  recordsNormalised: number;
  recordsPersisted: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
  /** The full set of normalised records (for testing / response). */
  records?: MarketPriceRecord[];
}

export interface MarketReliabilitySnapshot {
  source: MarketSourceId;
  /** 0..100, see MarketReliabilityService. */
  score: number;
  label: string;
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  consecutiveFailures: number;
  recentSuccessesLast24h: number;
  recentAttemptsLast24h: number;
  reasons: string[];
}

export interface MarketHistoryPoint {
  arrivalDate: string;
  modalPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  source: MarketSourceId;
}

export interface MarketComparisonRow {
  market: string;
  state: string;
  district?: string;
  commodity: string;
  modalPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  unit: string;
  arrivalDate: string;
  source: MarketSourceId;
  sourceSystem: string;
}

export interface MarketTodayInsight {
  commodity: string;
  market: string;
  state: string;
  modalPrice?: number;
  unit: string;
  arrivalDate: string;
  source: MarketSourceId;
  sourceSystem: string;
  trendPct?: number | null;
  changePct?: number | null;
  isDemo: boolean;
  fetchedAt: string;
}

/**
 * JSON-RPC 2.0 envelope used by FastMCP streamable-http transport.
 * Only the fields we consume are typed.
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {code: number; message: string; data?: unknown};
}

/** Result of a single MCP tool call. */
export interface McpToolResult<T = unknown> {
  ok: boolean;
  source: MarketSourceId;
  tool: string;
  data?: T;
  error?: string;
  durationMs: number;
}
