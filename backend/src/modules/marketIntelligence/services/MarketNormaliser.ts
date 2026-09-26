/**
 * MarketNormaliser â€” converts upstream MCP responses into the canonical
 * `MarketPriceRecord` shape. Pure: no I/O.
 *
 * Determinism:
 *   - `recordKey` is sha256(source|state|district|market|commodity|
 *     variety|grade|arrivalDate) truncated to 32 hex chars.
 *
 * Safety:
 *   - We never fabricate prices, coordinates or change percentages.
 *   - changePct is computed in MarketHistoryService from previous records.
 */

import {createHash} from 'crypto';
import {injectable} from 'inversify';
import type {MarketPriceRecord, MarketSourceId} from '../types.js';

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function toFiniteNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '').trim();
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function toIsoDate(v: unknown): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const dd = dmyMatch[1].padStart(2, '0');
      const mm = dmyMatch[2].padStart(2, '0');
      return `${dmyMatch[3]}-${mm}-${dd}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return undefined;
}

/**
 * PHASE 2 Â§P2.E â€” Today's date in **Asia/Kolkata (IST)** as a
 * YYYY-MM-DD string.
 *
 * Previously this used `new Date().toISOString().slice(0,10)`,
 * which is the *UTC* calendar day. On a server running UTC
 * (e.g. Cloud Run) that meant between 18:30 and 24:00 UTC
 * (= 00:00 to 05:30 IST the *next* day) `todayIso()` would
 * silently return *yesterday's* date â€” pushing every cron
 * trigger into the wrong mandi day.
 *
 * We now format with `Intl.DateTimeFormat` in the
 * `Asia/Kolkata` timezone, which is what farmers actually
 * read when they say "today's price". For the (rare)
 * queries that genuinely need UTC, callers should use
 * `new Date().toISOString().slice(0,10)` directly.
 */
export function todayIso(): string {
  return formatIstDate(new Date());
}

/** Format the IST (Asia/Kolkata) calendar date for `when`. */
export function formatIstDate(when: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(when);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}


/**
 * PHASE 2 Â§P2.D â€” Captcha / challenge-page detection.
 *
 * Agmarknet and eNAM upstreams occasionally return HTML
 * challenge pages (Cloudflare "Just a moment", Google reCAPTCHA)
 * instead of JSON. The previous normaliser silently returned
 * `[]` for such responses, and the ingestion layer logged a
 * zero-record success â€” masking the fact that the upstream was
 * actually rate-limiting us.
 *
 * These helpers run pure string / pattern checks on the raw
 * response payload, the parsed `McpToolResult.data`, or the
 * `McpToolResult.error` string. They NEVER throw.
 *
 * Exported so unit tests and downstream services can call them
 * without going through `MarketNormaliser` itself.
 */

/** Markers extracted from real Cloudflare / reCAPTCHA HTML pages. */
export const CAPTCHA_MARKERS: readonly string[] = [
  '<title>Just a moment',
  'cf-chl-bypass',
  'cf-challenge-form',
  'cf-chl-opt',
  'g-recaptcha',
  'Attention Required! | Cloudflare',
  'Verifying you are human',
  'Checking your browser before accessing',
];

/** True when `input` (case-insensitive) contains any captcha marker. */
export function detectCaptchaInString(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const lower = input.toLowerCase();
  return CAPTCHA_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

/**
 * Detect captcha markers in an MCP response payload (parsed or not).
 * Accepts:
 *   - string  â†’ checked directly
 *   - object  â†’ serialised once with JSON.stringify, then checked
 *   - null/undefined/other â†’ false
 */
export function detectCaptchaInPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return false;
  if (typeof payload === 'string') {
    return detectCaptchaInString(payload);
  }
  if (typeof payload === 'object') {
    try {
      return detectCaptchaInString(JSON.stringify(payload));
    } catch {
      return false;
    }
  }
  return false;
}

/** Detect captcha markers in an `McpToolResult.error` string. */
export function detectCaptchaInError(error: string | undefined): boolean {
  if (!error || typeof error !== 'string') return false;
  return detectCaptchaInString(error);
}

export function cleanString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildRecordKey(parts: {
  source: MarketSourceId;
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrivalDate?: string;
}): string {
  const norm = (s?: string) => (s ?? '').toString().trim().toLowerCase();
  const joined = [
    parts.source,
    norm(parts.state),
    norm(parts.district),
    norm(parts.market),
    norm(parts.commodity),
    norm(parts.variety),
    norm(parts.grade),
    norm(parts.arrivalDate),
  ].join('|');
  return createHash('sha256').update(joined).digest('hex').slice(0, 32);
}

// â”€â”€â”€ the service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@injectable()
export class MarketNormaliser {
  /**
   * Build a canonical record from discrete fields (post-persistence).
   */
  public buildRecord(input: {
    source: MarketSourceId;
    sourceSystem: string;
    sourceUrl?: string;
    commodity: string;
    crop?: string;
    commodityGroup?: string;
    variety?: string;
    grade?: string;
    market: string;
    district?: string;
    state: string;
    minPrice?: number;
    maxPrice?: number;
    modalPrice?: number;
    unit: string;
    arrivalDate: string;
    reportedAt?: string;
    arrivalQty?: number;
    /**
     * Provenance flag â€” true when this record was produced from an
     * Agmarknet dashboard/aggregate response and we cannot guarantee
     * it maps to a single mandi. See PHASE_1_CHECKLIST.md Â§P1.2.
     */
    isAggregate?: boolean;
  }): MarketPriceRecord | null {
    const arrivalDate = toIsoDate(input.arrivalDate) ?? todayIso();
    const commodity = cleanString(input.commodity);
    const market = cleanString(input.market);
    const state = cleanString(input.state);
    if (!commodity || !market || !state) return null;

    return {
      recordKey: buildRecordKey({
        source: input.source,
        state,
        district: input.district,
        market,
        commodity,
        variety: input.variety,
        grade: input.grade,
        arrivalDate,
      }),
      source: input.source,
      sourceSystem: input.sourceSystem,
      sourceUrl: input.sourceUrl,
      commodity,
      crop: input.crop ?? commodity,
      commodityGroup: cleanString(input.commodityGroup),
      variety: cleanString(input.variety),
      grade: cleanString(input.grade),
      market,
      district: cleanString(input.district),
      state,
      minPrice: toFiniteNumber(input.minPrice),
      maxPrice: toFiniteNumber(input.maxPrice),
      modalPrice: toFiniteNumber(input.modalPrice),
      unit: input.unit || '₹/quintal',
      arrivalDate,
      reportedAt: toIsoDate(input.reportedAt) ?? new Date().toISOString(),
      ingestedAt: new Date().toISOString(),
      arrivalQty: toFiniteNumber(input.arrivalQty),
      changePct: null,
      trendPct: null,
      fetchStatus: 'live',
      isAggregate: input.isAggregate === true ? true : undefined,
      timezone: 'Asia/Kolkata',
    };
  }

  /**
   * Normalise an Agmarknet response payload.
   * Accepts both the `marketwise_price_arrival_dynamic` envelope
   * (`{records: [...]}`) and the bare dashboard records array.
   */
  public normaliseAgmarknet(
    payload: unknown,
    fallbackDate: string,
    sourceUrl?: string,
  ): MarketPriceRecord[] {
    if (!payload) return [];
    const records = extractAgmarknetRecords(payload);
    if (!records.length) return [];

    const out: MarketPriceRecord[] = [];
    for (const raw of records) {
      const commodity = cleanString(raw.cmdt_name ?? raw.commodity);
      const market = cleanString(raw.mkt_name ?? raw.market);
      const state = cleanString(raw.state_name ?? raw.state);
      if (!commodity || !market || !state) continue;

      const arrivalDate =
        toIsoDate(raw.arrival_date ?? raw.date ?? raw.price_date) ??
        toIsoDate(fallbackDate) ??
        todayIso();

      // The `decorateAgmarknetAggregate` helper in MarketIngestionService
      // sets `isAggregate: true` on rows it produces from a state-level
      // dashboard response. We preserve that provenance tag here so the
      // downstream pipeline can distinguish per-mandi rows from
      // state-aggregate roll-ups. PHASE_1_CHECKLIST.md Â§P1.2.
      const isAggregate = (raw as any)?.isAggregate === true;

      const record = this.buildRecord({
        source: 'agmarknet',
        sourceSystem: 'Agmarknet',
        sourceUrl,
        commodity,
        crop: commodity,
        commodityGroup: cleanString(raw.cmdt_grp_name ?? raw.group_name),
        variety: cleanString(raw.variety ?? raw.variety_name),
        grade: cleanString(raw.grade ?? raw.grade_name),
        market,
        district: cleanString(raw.district_name ?? raw.district),
        state,
        minPrice: toFiniteNumber(raw.min_price ?? raw.minPrice),
        maxPrice: toFiniteNumber(raw.max_price ?? raw.maxPrice),
        modalPrice: toFiniteNumber(raw.modal_price ?? raw.modalPrice),
        unit: '₹/quintal',
        arrivalDate,
        reportedAt: toIsoDate(raw.arrival_date ?? raw.reported_at),
        arrivalQty: toFiniteNumber(
          raw.arrival_qty ?? raw.arrival_quantity ?? raw.arrival,
        ),
        isAggregate,
      });
      if (record) out.push(record);
    }
    return out;
  }

  /**
   * Normalise an eNAM `get_trade_data_list` payload.
   */
  public normaliseEnam(payload: unknown): MarketPriceRecord[] {
    if (!payload) return [];
    const tradeData = extractEnamTradeData(payload);
    if (!tradeData.length) return [];

    const meta = extractEnamMeta(payload);
    const out: MarketPriceRecord[] = [];
    for (const raw of tradeData) {
      const commodity =
        cleanString(raw.Commodity ?? raw.commodity) ?? meta?.commodity;
      const market =
        cleanString(raw.APMC ?? raw.apmc ?? raw.market) ?? meta?.apmc;
      const state = cleanString(raw.State ?? raw.state) ?? meta?.state;
      if (!commodity || !market || !state) continue;

      const arrivalDate =
        toIsoDate(raw['Price Date'] ?? raw.price_date ?? raw.arrival_date) ??
        meta?.availableDate ??
        todayIso();

      const record = this.buildRecord({
        source: 'enam',
        sourceSystem: 'eNAM',
        commodity,
        crop: commodity,
        variety: cleanString(raw.Variety ?? raw.variety),
        grade: cleanString(raw.Grade ?? raw.grade),
        market,
        district: cleanString(raw.District ?? raw.district),
        state,
        minPrice: toFiniteNumber(raw['Min Price'] ?? raw.min_price),
        maxPrice: toFiniteNumber(raw['Max Price'] ?? raw.max_price),
        modalPrice: toFiniteNumber(raw['Modal Price'] ?? raw.modal_price),
        unit: cleanString(raw.Unit ?? raw.unit) ?? '₹/quintal',
        arrivalDate,
        reportedAt: toIsoDate(raw['Price Date'] ?? raw.reported_at),
        arrivalQty: toFiniteNumber(
          raw['Arrival Qty'] ?? raw.arrival_qty ?? raw.arrival_quantity,
        ),
      });
      if (record) out.push(record);
    }
    return out;
  }
}

function extractAgmarknetRecords(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.records && Array.isArray(payload.records)) return payload.records;
  if (payload?.data?.records && Array.isArray(payload.data.records))
    return payload.data.records;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
}

function extractEnamTradeData(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.trade_data && Array.isArray(payload.trade_data))
    return payload.trade_data;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
}

function extractEnamMeta(payload: any): {
  state?: string;
  apmc?: string;
  commodity?: string;
  availableDate?: string;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  return {
    state: cleanString(payload.state),
    apmc: cleanString(payload.apmc),
    commodity: cleanString(payload.commodity),
    availableDate: toIsoDate(payload.available_date),
  };
}
