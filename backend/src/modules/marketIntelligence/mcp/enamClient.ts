/**
 * eNAM MCP client.
 *
 * Wraps the existing `apis/proxy_api/mcp_containers/market/market_mcp.py`
 * MCP server (streamable-http transport, port 9022 by default).
 *
 * The server exposes the following tools we use:
 *   - get_apmc_list_from_enam(state_name)
 *   - get_commodity_list_from_enam(state_name, apmc_name, from_date, to_date)
 *   - get_trade_data_list(state_name, apmc_name, commodity_name,
 *                         from_date, to_date)
 *
 * All methods here:
 *   - never throw (failures are returned as McpToolResult.ok=false)
 *   - log source/tool/error context
 *   - timeout cleanly so the backend cannot hang on a dead MCP
 */

import {injectable} from 'inversify';
import {jsonRpcCall, resolveMcpEndpoint} from './jsonRpcHttp.js';
import type {McpToolResult} from '../types.js';

const ENV_KEY = 'MARKET_MCP_ENAM_URL';
const DEFAULT_ENDPOINT = 'http://market_enam:9022/mcp';

export interface EnamTradeQuery {
  state_name: string;
  apmc_name: string;
  commodity_name: string;
  /** YYYY-MM-DD. Defaults to today. The server walks up to 7 days back. */
  from_date?: string;
  to_date?: string;
}

@injectable()
export class EnamMcpClient {
  private endpoint: string;

  constructor() {
    this.endpoint =
      resolveMcpEndpoint(ENV_KEY, DEFAULT_ENDPOINT) || DEFAULT_ENDPOINT;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public async listApmcs(stateName: string): Promise<McpToolResult> {
    return this.invoke('get_apmc_list_from_enam', {state_name: stateName});
  }

  public async listCommodities(
    stateName: string,
    apmcName: string,
    fromDate: string,
    toDate: string,
  ): Promise<McpToolResult> {
    return this.invoke('get_commodity_list_from_enam', {
      state_name: stateName,
      apmc_name: apmcName,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  public async fetchTradeData(q: EnamTradeQuery): Promise<McpToolResult> {
    return this.invoke('get_trade_data_list', {
      state_name: q.state_name,
      apmc_name: q.apmc_name,
      commodity_name: q.commodity_name,
      from_date: q.from_date ?? today(),
      to_date: q.to_date ?? today(),
    });
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
        source: 'enam',
        tool,
        data,
        durationMs: Date.now() - started,
      };
    } catch (err: any) {
      console.warn(
        `[marketIntelligence] enam ${tool} failed: ${err?.message || err}`,
      );
      return {
        ok: false,
        source: 'enam',
        tool,
        error: err?.message ?? String(err),
        durationMs: Date.now() - started,
      };
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
