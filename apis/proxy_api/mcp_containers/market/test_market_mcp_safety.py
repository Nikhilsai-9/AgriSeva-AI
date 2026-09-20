"""
Offline smoke test for the safety wrapper in market_mcp.py.

Verifies the previously-unhandled failure modes are now caught and converted
to structured error envelopes (no exception escapes):

  1. eNAM returns 200 with HTML body.
  2. eNAM returns 503.
  3. eNAM returns 200 with malformed JSON.
  4. Happy path: 200 with valid JSON.
  5. _get_apmc_list_from_enam with HTML upstream.
  6. _get_apmc_list_from_enam with invalid state name (no network).
"""
import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(
    0, r"C:/Users/saini/OneDrive/Desktop/CSP/AgriSeva-Ai/apis/proxy_api/mcp_containers/market"
)

import market_mcp


def make_response(status: int, content_type: str, body: str) -> MagicMock:
    resp = MagicMock()
    resp.status = status
    resp.headers = {"Content-Type": content_type}

    async def _text():
        return body

    resp.text = AsyncMock(side_effect=_text)
    resp.__aenter__ = AsyncMock(return_value=resp)
    resp.__aexit__ = AsyncMock(return_value=None)
    return resp


def make_session(responses):
    session = MagicMock()
    iter_ = iter(responses)

    def _post(*args, **kwargs):
        try:
            return next(iter_)
        except StopIteration:
            raise AssertionError("session.post called too many times")

    session.post = _post
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)
    return session


async def main():
    ok = True

    # 1) HTML response
    s = make_session([make_response(200, "text/html", "<html>blocked</html>")])
    r = await market_mcp._safe_fetch_json(s, "http://x/", label="t")
    if r.get("status") == 200 and r.get("error") == "non_json_response":
        print("[ OK ] 1. HTML response -> non_json_response")
    else:
        print(f"[FAIL] 1. {r}"); ok = False

    # 2) HTTP 503
    s = make_session([make_response(503, "text/html", "<html>oops</html>")])
    r = await market_mcp._safe_fetch_json(s, "http://x/", label="t")
    if r.get("status") == 503 and r.get("error") == "http_error":
        print("[ OK ] 2. 503 -> http_error")
    else:
        print(f"[FAIL] 2. {r}"); ok = False

    # 3) Malformed JSON
    s = make_session([make_response(200, "application/json", "not-json")])
    r = await market_mcp._safe_fetch_json(s, "http://x/", label="t")
    if r.get("error") == "json_parse_error":
        print("[ OK ] 3. bad JSON -> json_parse_error")
    else:
        print(f"[FAIL] 3. {r}"); ok = False

    # 4) Happy path
    s = make_session([make_response(200, "application/json", '{"data": [{"apmc_name": "X"}]}')])
    r = await market_mcp._safe_fetch_json(s, "http://x/", label="t")
    if r.get("status") == 200 and r.get("data", {}).get("data"):
        print(f"[ OK ] 4. good JSON -> data with {len(r['data']['data'])} rows")
    else:
        print(f"[FAIL] 4. {r}"); ok = False

    # 5) _get_apmc_list_from_enam against HTML upstream
    s = make_session([make_response(200, "text/html", "<html>blocked</html>")])
    orig = market_mcp.aiohttp.ClientSession
    market_mcp.aiohttp.ClientSession = lambda: s
    try:
        r = await market_mcp._get_apmc_list_from_enam("Gujarat")
    finally:
        market_mcp.aiohttp.ClientSession = orig
    if r.get("error") == "non_json_response":
        print("[ OK ] 5. _get_apmc_list_from_enam with HTML -> graceful")
    else:
        print(f"[FAIL] 5. {r}"); ok = False

    # 6) Invalid state (no network)
    r = await market_mcp._get_apmc_list_from_enam("Atlantis")
    if r.get("status") == 400 and "Invalid state" in r.get("error", ""):
        print("[ OK ] 6. invalid state -> 400 with suggestions")
    else:
        print(f"[FAIL] 6. {r}"); ok = False

    # 7) _get_commodity_list_from_enam when apmc upstream returns HTML.
    # Should propagate the apmc_list error envelope (not crash on missing 'apmcs').
    s = make_session([make_response(200, "text/html", "<html>blocked</html>")])
    orig = market_mcp.aiohttp.ClientSession
    market_mcp.aiohttp.ClientSession = lambda: s
    try:
        r = await market_mcp._get_commodity_list_from_enam(
            "Gujarat", "Ahmedabad", "2026-09-19", "2026-09-19"
        )
    finally:
        market_mcp.aiohttp.ClientSession = orig
    if r.get("error") == "non_json_response":
        print("[ OK ] 7. _get_commodity_list_from_enam propagates apmc_list error")
    else:
        print(f"[FAIL] 7. {r}"); ok = False

    # 8) _get_trade_data_list when apmc upstream returns HTML.
    s = make_session([make_response(200, "text/html", "<html>blocked</html>")])
    market_mcp.aiohttp.ClientSession = lambda: s
    try:
        r = await market_mcp._get_trade_data_list(
            "Gujarat", "Ahmedabad", "Cotton", "2026-09-19", "2026-09-19"
        )
    finally:
        market_mcp.aiohttp.ClientSession = orig
    if r.get("error") == "non_json_response":
        print("[ OK ] 8. _get_trade_data_list propagates apmc_list error")
    else:
        print(f"[FAIL] 8. {r}"); ok = False

    print()
    print("ALL OK" if ok else "FAILURES")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(main())
