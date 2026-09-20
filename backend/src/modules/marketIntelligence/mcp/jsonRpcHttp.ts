/**
 * JSON-RPC 2.0 client for FastMCP streamable-http transports.
 *
 * Behaviour:
 *   - Performs the MCP `initialize` handshake lazily (one per endpoint)
 *     and caches the returned `mcp-session-id`.
 *   - Sends `Accept: application/json, text/event-stream` (FastMCP
 *     refuses requests that don't accept both).
 *   - Parses either an SSE frame (`event: message\ndata: {...}`) or a
 *     plain JSON body, depending on the response content-type.
 *   - For `tools/call` responses, unwraps the standard MCP content
 *     envelope (`{content: [{type: 'text', text: '...'}]}`) so callers
 *     receive the JSON payload the underlying tool returned.
 *
 * The client never throws on transient errors — every failure is
 * surfaced as an Error so the calling service can convert it into an
 * `McpToolResult.ok = false` outcome.
 */

import {env} from '#root/utils/env.js';
import type {JsonRpcRequest, JsonRpcResponse} from '../types.js';

export interface JsonRpcCallOptions {
  /** Override the default request timeout in ms. */
  timeoutMs?: number;
  /** Extra headers (e.g. trace IDs). */
  headers?: Record<string, string>;
  /** Optional abort signal. */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = '2024-11-05';

// ─── session cache (per endpoint) ───────────────────────────────────────
const sessionCache = new Map<string, string>();
const sessionInitPromises = new Map<string, Promise<string>>();

async function ensureSession(
  endpoint: string,
  signal: AbortSignal,
): Promise<string> {
  const cached = sessionCache.get(endpoint);
  if (cached) return cached;
  const existing = sessionInitPromises.get(endpoint);
  if (existing) return existing;
  const promise = (async () => {
    const initBody = {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {name: 'agriseva-backend', version: '1.0'},
      },
    };
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(initBody),
      signal,
    });
    if (!r.ok) {
      const t = await safeReadText(r);
      throw new Error(
        `MCP initialize ${endpoint} HTTP ${r.status}: ${t.slice(0, 200)}`,
      );
    }
    const sid = r.headers.get('mcp-session-id');
    if (!sid) {
      throw new Error(`MCP initialize ${endpoint}: no mcp-session-id header`);
    }
    try { await r.text(); } catch { /* ignore */ }
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-session-id': sid,
        },
        body: JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}),
        signal,
      });
    } catch { /* ignore */ }
    sessionCache.set(endpoint, sid);
    return sid;
  })();
  sessionInitPromises.set(endpoint, promise);
  try { return await promise; } finally { sessionInitPromises.delete(endpoint); }
}

/**
 * Perform a JSON-RPC 2.0 `tools/call` against a FastMCP HTTP endpoint.
 *
 * @param endpoint  Full URL of the MCP HTTP endpoint (e.g. http://x:9004/mcp).
 * @param tool      Tool name to invoke.
 * @param args      Tool arguments (will be JSON-encoded into params).
 * @param options   Optional timeout/headers.
 * @returns         The decoded JSON-RPC result on success.
 * @throws          If the HTTP call fails, times out, returns non-2xx,
 *                  or the server returns an RPC error.
 */
// ─── SSE / JSON parsing ─────────────────────────────────────────────────

/**
 * Extract the JSON payload from an SSE response body.
 * FastMCP emits `event: message\ndata: <json>\n\n` frames.
 */
function parseSseBody(body: string): JsonRpcResponse<unknown> {
  const dataLines: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    if (rawLine.startsWith('data:')) {
      dataLines.push(rawLine.slice(5).replace(/^ /, ''));
    }
  }
  if (dataLines.length === 0) {
    throw new Error('MCP SSE body contained no data frames');
  }
  try {
    return JSON.parse(dataLines.join('\n')) as JsonRpcResponse<unknown>;
  } catch (err: any) {
    throw new Error(`MCP SSE body is not valid JSON: ${err?.message}`);
  }
}

async function readJsonRpcResponse(r: Response): Promise<JsonRpcResponse<unknown>> {
  const ct = (r.headers.get('content-type') ?? '').toLowerCase();
  if (ct.includes('text/event-stream')) {
    return parseSseBody(await r.text());
  }
  return (await r.json()) as JsonRpcResponse<unknown>;
}

/**
 * Unwrap standard MCP `tools/call` content envelope, if present.
 */
function unwrapMcpContent(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const r: any = result;
  if (Array.isArray(r.content) && r.content.length > 0) {
    const first = r.content[0];
    if (first && first.type === 'text' && typeof first.text === 'string') {
      try { return JSON.parse(first.text); } catch { return first.text; }
    }
  }
  return result;
}

// ─── public API ─────────────────────────────────────────────────────────

export async function jsonRpcCall<T = unknown>(
  endpoint: string,
  tool: string,
  args: Record<string, unknown> = {},
  options: JsonRpcCallOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('jsonRpcCall: missing endpoint URL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ?? controller.signal;

  let sid: string;
  try {
    sid = await ensureSession(endpoint, signal);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      throw new Error(`MCP initialize to ${endpoint} timed out after ${timeoutMs}ms`);
    }
    throw new Error(`MCP initialize to ${endpoint} failed: ${err?.message || String(err)}`);
  }

  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {name: tool, arguments: args},
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sid,
        ...(options.headers ?? {}),
      },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      throw new Error(`MCP request to ${endpoint} timed out after ${timeoutMs}ms`);
    }
    throw new Error(`MCP request to ${endpoint} failed: ${err?.message || String(err)}`);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new Error(
      `MCP ${endpoint} returned HTTP ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  let parsed: JsonRpcResponse<unknown>;
  try {
    parsed = await readJsonRpcResponse(response);
  } catch (err: any) {
    throw new Error(`MCP ${endpoint} returned non-JSON body: ${err?.message}`);
  }

  if (parsed?.error) {
    throw new Error(
      `MCP ${endpoint} tool=${tool} rpc error ${parsed.error.code}: ${parsed.error.message}`,
    );
  }

  if (parsed?.result === undefined) {
    throw new Error(`MCP ${endpoint} tool=${tool} returned empty result envelope`);
  }

  return unwrapMcpContent(parsed.result) as T;
}

async function safeReadText(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ''; }
}

/**
 * Resolve an MCP endpoint URL from env, returning `null` when unset/empty.
 */
export function resolveMcpEndpoint(envKey: string, fallback = ''): string {
  const v = env(envKey, '');
  return (v || fallback || '').trim();
}

/**
 * Test-only: forget cached sessions. Not used at runtime.
 */
export function __resetJsonRpcSessionsForTests(): void {
  sessionCache.clear();
  sessionInitPromises.clear();
}
