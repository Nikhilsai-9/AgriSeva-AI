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
  private async invoke(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const started = Date.now();
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
      // Log but never throw — caller decides.
      console.warn(
        `[marketIntelligence] agmarknet ${tool} failed: ${err?.message || err}`,
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
