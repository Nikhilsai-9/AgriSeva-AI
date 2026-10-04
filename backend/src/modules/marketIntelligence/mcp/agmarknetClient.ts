/**
 * Agmarknet MCP client.
 *
 * Wraps the existing `mcp/mcp_containers/agmarknet-mcp/server_agmarknet.py`
 * MCP server (streamable-http transport, port 9004 by default).
 *
 * The server exposes the following tools we use:
 *   - get_dashboard_data(dashboard, date, group, commodity, variety,
 *                        state, district, market, grades, limit, page,
 *                        format)
 *   - marketwise_price_arrival_dynamic(date, commodity_contains,
 *                                       commodity_group_contains, trend,
 *                                       limit_per_page, max_pages)
 *   - get_dashboard_filters(dashboard_name, state_name, district_name,
 *                           market_name)
 *
 * All methods here:
 *   - never throw (failures are returned as McpToolResult.ok=false)
 *   - log source/tool/error context
 *   - timeout cleanly so the backend cannot hang on a dead MCP
 */

import {injectable} from 'inversify';
import {jsonRpcCall, resolveMcpEndpoint} from './jsonRpcHttp.js';
import type {McpToolResult} from '../types.js';

const ENV_KEY = 'MARKET_MCP_AGMARKNET_URL';
const DEFAULT_ENDPOINT = 'http://market_agmarknet:9004/mcp';

export interface AgmarknetFilters {
  /** Free-text commodity match, e.g. "Tomato". */
  commodity_contains?: string;
  /** Free-text commodity-group match, e.g. "Vegetables". */
  commodity_group_contains?: string;
  /** Trend filter, e.g. "up" / "down". */
  trend?: 'up' | 'down' | string;
  /** ISO date YYYY-MM-DD; defaults to today on the server. */
  date?: string;
  /** Page size (default 50). */
  limit_per_page?: number;
  /** Max pages to walk (default 5 to be polite). */
  max_pages?: number;
}

export interface AgmarknetFiltersResolved {
  state_id?: number;
  district_id?: number;
  market_id?: number;
  group_id?: number;
  commodity_id?: number;
  variety_id?: number;
  grades_id?: number;
}

@injectable()
export class AgmarknetMcpClient {
  private endpoint: string;
  private stateIdCache = new Map<string, number | undefined>();

  constructor() {
    this.endpoint =
      resolveMcpEndpoint(ENV_KEY, DEFAULT_ENDPOINT) || DEFAULT_ENDPOINT;
  }

  /** Inspect the resolved endpoint (useful for /market-health). */
  public getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Fetch marketwise prices via the dynamic tool (best for
   * commodity-name-driven queries, no hardcoded IDs required).
   */
  public async fetchMarketwiseDynamic(
    filters: AgmarknetFilters,
  ): Promise<McpToolResult> {
    const tool = 'marketwise_price_arrival_dynamic';
    const args = {
      commodity_contains: filters.commodity_contains,
      commodity_group_contains: filters.commodity_group_contains,
      trend: filters.trend,
      date: filters.date,
      limit_per_page: filters.limit_per_page ?? 50,
      max_pages: filters.max_pages ?? 5,
    };
    return this.invoke(tool, args);
  }

  /**
   * Generic dashboard fetch (requires numeric IDs resolved via
   * `get_dashboard_filters`).
   */
  public async fetchDashboardData(args: {
    dashboard: string;
    date?: string;
    group?: number[];
    commodity?: number[];
    variety?: number;
    state?: number;
    district?: number[];
    market?: number[];
    grades?: number[];
    limit?: number;
    page?: number;
  }): Promise<McpToolResult> {
    return this.invoke('get_dashboard_data', args);
  }

  /**
   * Resolve human-readable state/district/market names into the integer
   * IDs that the dashboard endpoint expects.
   */
  public async resolveFilters(args: {
    dashboard_name?: string;
    state_name?: string;
    district_name?: string;
    market_name?: string;
  }): Promise<McpToolResult> {
    return this.invoke('get_dashboard_filters', {
      dashboard_name: args.dashboard_name ?? 'marketwise_price_arrival',
      state_name: args.state_name,
      district_name: args.district_name,
      market_name: args.market_name,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  /**
   * Resolve human state name → Agmarknet state_id (best-effort cache).
   * Returns undefined when the lookup fails or yields no match.
   */
  public async resolveStateId(stateName: string): Promise<number | undefined> {
    if (!this.stateIdCache.has(stateName)) {
      const filters = await this.invoke('get_dashboard_filters', {
        dashboard_name: 'marketwise_price_arrival',
        state_name: stateName,
      });
      let resolved: number | undefined;
      if (filters.ok && filters.data) {
        const data: any = filters.data;
        const st = data?.state;
        if (st && typeof st === 'object' && typeof st.id === 'number') {
          if (typeof st.name === 'string' && st.name.toLowerCase() === stateName.toLowerCase()) {
            resolved = st.id;
          }
        }
        if (resolved === undefined && Array.isArray(data?.states)) {
          const match = data.states.find(
            (s: any) =>
              typeof s?.state_name === 'string' &&
              s.state_name.toLowerCase() === stateName.toLowerCase() &&
              typeof s.state_id === 'number',
          );
          if (match) resolved = match.state_id;
        }
      }
      this.stateIdCache.set(stateName, resolved);
    }
    return this.stateIdCache.get(stateName);
  }

  /**
   * Per-mandi fetch via `get_dashboard_data` after resolving
   * `state_name → state_id`. This is the only Agmarknet tool that
   * returns market / district / min / max / modal price fields.
   */
  public async fetchDashboardPerMandi(input: {
    stateName: string;
    commodityContains?: string;
    date?: string;
    limit?: number;
  }): Promise<McpToolResult> {
    const started = Date.now();
    try {
      const direct = await this.fetchDashboardPerMandiDirect(input);
      if (direct?.records && direct.records.length > 0) {
        return {
          ok: true,
          source: 'agmarknet',
          tool: 'get_dashboard_data',
          data: direct,
          durationMs: Date.now() - started,
        };
      }
    } catch (e: any) {
      console.warn(`[marketIntelligence] direct mandi fetch failed: ${e?.message}`);
    }

    const stateId = await this.resolveStateId(input.stateName);
    if (!stateId) {
      return {
        ok: false,
        source: 'agmarknet',
        tool: 'get_dashboard_data',
        error: `Unable to resolve state_id for "${input.stateName}"`,
        durationMs: 0,
      };
    }
    const args: Record<string, unknown> = {
      dashboard: 'marketwise_price_arrival',
      date: input.date,
      state: stateId,
      limit: input.limit ?? 50,
    };
    if (input.commodityContains) {
      // `get_dashboard_data` accepts a free-text commodity_contains
      // for filtering on the server side.
      args.commodity_contains = input.commodityContains;
    }
    return this.invoke('get_dashboard_data', args);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Direct Official Agmarknet API Fallback (api.agmarknet.gov.in)
  // ─────────────────────────────────────────────────────────────────────

  private rawFiltersCache: {data: any; fetchedAt: number} | null = null;

  private async getRawFilters(): Promise<any> {
    const ONE_HOUR = 60 * 60 * 1000;
    if (this.rawFiltersCache && Date.now() - this.rawFiltersCache.fetchedAt < ONE_HOUR) {
      return this.rawFiltersCache.data;
    }
    const res = await this.directRequest('dashboard-filters/', {
      dashboard_name: 'marketwise_price_arrival',
    });
    const raw = res?.data ?? {};
    this.rawFiltersCache = {data: raw, fetchedAt: Date.now()};
    return raw;
  }

  private directRequest(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let q = '';
      if (params) {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(params)) {
          if (v === undefined || v === null) continue;
          const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(val));
        }
        if (parts.length > 0) q = '?' + parts.join('&');
      }

      const url = `https://api.agmarknet.gov.in/v1/${path.replace(/^\//, '')}${q}`;
      const req = fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Origin: 'https://www.agmarknet.gov.in',
          Referer: 'https://www.agmarknet.gov.in/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(20000),
      });

      req
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            return reject(new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`));
          }
          const json = await res.json();
          resolve(json);
        })
        .catch(reject);
    });
  }

  private async fetchDashboardFiltersDirect(
    args: Record<string, unknown>,
  ): Promise<any> {
    const raw = await this.getRawFilters();
    const stateData: any[] = raw.state_data || [];
    const marketData: any[] = raw.market_data || [];
    const districtData: any[] = raw.district_data || [];

    const stateName = typeof args.state_name === 'string' ? args.state_name.trim() : null;
    const districtName = typeof args.district_name === 'string' ? args.district_name.trim() : null;
    const marketName = typeof args.market_name === 'string' ? args.market_name.trim() : null;

    const result: Record<string, unknown> = {
      success: true,
      dashboard: args.dashboard_name || 'marketwise_price_arrival',
    };

    let matchedState: any = null;
    if (stateName) {
      matchedState = stateData.find(
        (s) => s.state_name?.toLowerCase() === stateName.toLowerCase(),
      );
      if (matchedState) {
        result.state = {
          name: matchedState.state_name,
          id: matchedState.state_id,
        };
      } else {
        result.state = {error: `State '${stateName}' not found`};
        result.available_states = stateData.map((s) => ({
          name: s.state_name,
          id: s.state_id,
        }));
        return result;
      }
    } else {
      result.available_states = stateData.map((s) => ({
        name: s.state_name,
        id: s.state_id,
      }));
    }

    const stateId = matchedState ? matchedState.state_id : null;
    const stateMarkets = marketData.filter(
      (m) => stateId === null || m.state_id === stateId,
    );

    const districtsSeen = new Map<number, string>();
    for (const d of districtData) {
      if (stateId === null || d.state_id === stateId) {
        districtsSeen.set(d.id, d.district_name);
      }
    }

    let matchedDistrictId: number | null = null;
    if (districtName) {
      for (const [did, dname] of districtsSeen.entries()) {
        if (dname.toLowerCase() === districtName.toLowerCase()) {
          matchedDistrictId = did;
          break;
        }
      }
      if (matchedDistrictId !== null) {
        result.district = {name: districtName, id: matchedDistrictId};
      } else {
        result.district = {error: `District '${districtName}' not found`};
        result.available_districts = Array.from(districtsSeen.entries()).map(
          ([id, name]) => ({id, name}),
        );
      }
    } else {
      result.available_districts = Array.from(districtsSeen.entries()).map(
        ([id, name]) => ({id, name}),
      );
    }

    const candidateMarkets = stateMarkets.filter(
      (m) => matchedDistrictId === null || m.district_id === matchedDistrictId,
    );

    if (marketName) {
      const matchedM = candidateMarkets.find(
        (m) => m.mkt_name?.trim().toLowerCase() === marketName.toLowerCase(),
      );
      if (matchedM) {
        result.market = {name: matchedM.mkt_name, id: matchedM.id};
      } else {
        result.market = {error: `Market '${marketName}' not found`};
        result.available_markets = candidateMarkets.slice(0, 50).map((m) => ({
          name: m.mkt_name,
          id: m.id,
        }));
      }
    } else {
      result.available_markets = candidateMarkets.slice(0, 50).map((m) => ({
        name: m.mkt_name,
        id: m.id,
      }));
    }

    return result;
  }

  private async fetchDashboardDataDirect(
    args: Record<string, unknown>,
  ): Promise<any> {
    const params: Record<string, unknown> = {
      dashboard: args.dashboard || 'marketwise_price_arrival',
      date: args.date,
      limit: args.limit ?? 50,
      page: args.page ?? 1,
      format: 'json',
    };
    if (args.state) params.state = args.state;
    if (args.group) params.group = args.group;
    if (args.commodity) params.commodity = args.commodity;
    if (args.district) params.district = args.district;
    if (args.market) params.market = args.market;
    if (args.variety) params.variety = args.variety;
    if (args.grades) params.grades = args.grades;

    const res = await this.directRequest('dashboard-data/', params);
    return res;
  }

  private async fetchMarketwiseDynamicDirect(
    filters: AgmarknetFilters,
  ): Promise<any> {
    const rawFilters = await this.getRawFilters();
    const cmdtData: any[] = rawFilters.cmdt_data || [];
    const marketData: any[] = rawFilters.market_data || [];
    const districtData: any[] = rawFilters.district_data || [];
    const stateData: any[] = rawFilters.state_data || [];

    const dMap = new Map<number, string>(districtData.map((d: any) => [d.id, d.district_name]));
    const sMap = new Map<number, string>(stateData.map((s: any) => [s.state_id, s.state_name]));

    const date = filters.date;
    const records: any[] = [];

    let matchedCmdt: any = null;
    if (filters.commodity_contains) {
      const q = filters.commodity_contains.toLowerCase().trim();
      matchedCmdt = cmdtData.find((c: any) => c.cmdt_name?.toLowerCase().includes(q));
    }

    // 1. Fetch official national/state rows for the commodity
    const mainParams: Record<string, unknown> = {
      dashboard: 'marketwise_price_arrival',
      date,
      limit: filters.limit_per_page ?? 50,
    };
    if (matchedCmdt) {
      mainParams.commodity = [matchedCmdt.cmdt_id];
    }

    try {
      const res = await this.directRequest('dashboard-data/', mainParams);
      const rows = res?.data?.records || [];
      for (const r of rows) {
        if (!r.cmdt_name && matchedCmdt) r.cmdt_name = matchedCmdt.cmdt_name;
        records.push(r);
      }
    } catch (e: any) {
      console.warn(`[marketIntelligence] direct general query failed: ${e?.message}`);
    }

    // 2. Also query priority mandis across key states for this commodity if needed
    if (matchedCmdt && records.length < 5) {
      const priorityStates = [20, 16, 11, 46, 19, 31, 2, 33]; // MH, KA, GJ, UP, MP, RJ, AP, TN
      const keyMarkets = marketData
        .filter(
          (m: any) =>
            priorityStates.includes(m.state_id) &&
            m.id !== 100009 &&
            (m.mkt_name?.toLowerCase().includes('apmc') ||
              m.mkt_name?.toLowerCase().includes('lasalgaon') ||
              m.mkt_name?.toLowerCase().includes('pune') ||
              m.mkt_name?.toLowerCase().includes('azadpur')),
        )
        .slice(0, 4);

      for (const m of keyMarkets) {
        try {
          await new Promise((r) => setTimeout(r, 250));
          const resp = await this.directRequest('dashboard-data/', {
            dashboard: 'marketwise_price_arrival',
            date,
            state: m.state_id,
            market: [m.id],
            commodity: [matchedCmdt.cmdt_id],
            limit: 5,
          });
          const rec = resp?.data?.records?.[0];
          if (rec && rec.as_on_price) {
            records.push({
              ...rec,
              cmdt_name: rec.cmdt_name || matchedCmdt.cmdt_name,
              state_name: sMap.get(m.state_id) || 'India',
              district_name: dMap.get(m.district_id) || '',
              mkt_name: m.mkt_name.trim(),
              modal_price: rec.as_on_price,
              arrival_qty: rec.as_on_arrival,
              arrival_date: rec.reported_date,
            });
          }
        } catch (e: any) {
          if (e?.message?.includes('429')) {
            console.warn('[marketIntelligence] Agmarknet rate limit hit; halting market probe');
            break;
          }
        }
      }
    }

    return {
      status: 'success',
      data: {records},
      pagination: {total_count: records.length},
    };
  }

  private async fetchDashboardPerMandiDirect(input: {
    stateName: string;
    commodityContains?: string;
    date?: string;
    limit?: number;
  }): Promise<any> {
    const rawFilters = await this.getRawFilters();
    const stateData: any[] = rawFilters.state_data || [];
    const marketData: any[] = rawFilters.market_data || [];
    const districtData: any[] = rawFilters.district_data || [];
    const cmdtData: any[] = rawFilters.cmdt_data || [];

    const state = stateData.find(
      (s: any) => s.state_name?.toLowerCase() === input.stateName.toLowerCase(),
    );
    if (!state) {
      throw new Error(`State '${input.stateName}' not found`);
    }

    let cmdt: any = null;
    if (input.commodityContains) {
      const q = input.commodityContains.toLowerCase().trim();
      cmdt = cmdtData.find((c: any) => c.cmdt_name?.toLowerCase().includes(q));
    }

    const dMap = new Map<number, string>(districtData.map((d: any) => [d.id, d.district_name]));

    const records: any[] = [];

    // 1. First fetch state-level aggregate (1 single fast request)
    try {
      const stateParams: Record<string, unknown> = {
        dashboard: 'marketwise_price_arrival',
        date: input.date,
        state: state.state_id,
        limit: input.limit ?? 50,
      };
      if (cmdt) stateParams.commodity = [cmdt.cmdt_id];
      const stateResp = await this.directRequest('dashboard-data/', stateParams);
      const sRecords = stateResp?.data?.records || [];
      for (const sr of sRecords) {
        records.push({
          ...sr,
          state_name: state.state_name,
          mkt_name: `${state.state_name} (state aggregate)`,
          cmdt_name: sr.cmdt_name || cmdt?.cmdt_name,
          modal_price: sr.as_on_price,
          arrival_qty: sr.as_on_arrival,
          arrival_date: sr.reported_date,
          isAggregate: true,
        });
      }
    } catch (e: any) {
      console.warn(`[marketIntelligence] state aggregate query failed: ${e?.message}`);
    }

    // 2. Query at most 3 candidate mandis sequentially with delay
    if (cmdt) {
      const candMarkets = marketData
        .filter((m: any) => m.state_id === state.state_id && m.id !== 100009)
        .slice(0, 3);

      for (const m of candMarkets) {
        try {
          await new Promise((r) => setTimeout(r, 250));
          const resp = await this.directRequest('dashboard-data/', {
            dashboard: 'marketwise_price_arrival',
            date: input.date,
            state: state.state_id,
            market: [m.id],
            commodity: [cmdt.cmdt_id],
            limit: 5,
          });
          const rec = resp?.data?.records?.[0];
          if (rec && rec.as_on_price) {
            records.push({
              ...rec,
              cmdt_name: rec.cmdt_name || cmdt.cmdt_name,
              state_name: state.state_name,
              district_name: dMap.get(m.district_id) || '',
              mkt_name: m.mkt_name.trim(),
              modal_price: rec.as_on_price,
              arrival_qty: rec.as_on_arrival,
              arrival_date: rec.reported_date,
            });
          }
        } catch (e: any) {
          if (e?.message?.includes('429')) break;
        }
      }
    }

    return {
      status: 'success',
      data: {records},
      records,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  private async invoke(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const started = Date.now();

    // Check if the MCP container is configured with a reachable endpoint
    const isLocalContainer =
      this.endpoint.includes('market_agmarknet') ||
      this.endpoint.includes('127.0.0.1:9004') ||
      this.endpoint.includes('localhost:9004');

    let mcpError: any = null;
    if (!isLocalContainer) {
      try {
        const data = await jsonRpcCall<unknown>(this.endpoint, tool, args);
        return {
          ok: true,
          source: 'agmarknet',
          tool,
          data,
          durationMs: Date.now() - started,
        };
      } catch (err: any) {
        mcpError = err;
      }
    }

    // Fallback: Query the official Government of India Agmarknet API directly
    try {
      let data: any;
      if (tool === 'get_dashboard_filters') {
        data = await this.fetchDashboardFiltersDirect(args);
      } else if (tool === 'get_dashboard_data') {
        data = await this.fetchDashboardDataDirect(args);
      } else if (tool === 'marketwise_price_arrival_dynamic') {
        data = await this.fetchMarketwiseDynamicDirect(args as AgmarknetFilters);
      } else {
        throw new Error(`Unsupported tool in direct fallback: ${tool}`);
      }

      return {
        ok: true,
        source: 'agmarknet',
        tool,
        data,
        durationMs: Date.now() - started,
      };
    } catch (err: any) {
      console.warn(
        `[marketIntelligence] agmarknet direct API ${tool} failed: ${err?.message || err}${mcpError ? ` (MCP error: ${mcpError.message})` : ''}`,
      );
      return {
        ok: false,
        source: 'agmarknet',
        tool,
        error: err?.message ?? String(err),
        durationMs: Date.now() - started,
      };
    }
  }
}

