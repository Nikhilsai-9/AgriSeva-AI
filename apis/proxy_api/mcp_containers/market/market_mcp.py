


from typing import List
import aiohttp
import json
import difflib
from datetime import datetime, timedelta
from fastmcp import FastMCP

# -------------------------------------------------------------------
# MCP setup
# -------------------------------------------------------------------

mcp = FastMCP("Market")

# -------------------------------------------------------------------
# Constants & mappings
# -------------------------------------------------------------------

STATE_NAME_TO_ID = {
    "andaman and nicobar islands": "37",
    "andhra pradesh": "276",
    "assam": "38",
    "bihar": "33",
    "chandigarh": "526",
    "chhattisgarh": "100",
    "goa": "34",
    "gujarat": "22",
    "haryana": "32",
    "himachal pradesh": "43",
    "jammu and kashmir": "696",
    "jharkhand": "47",
    "karnataka": "695",
    "kerala": "694",
    "madhya pradesh": "20",
    "maharashtra": "296",
    "nagaland": "35",
    "odisha": "384",
    "puducherry": "599",
    "punjab": "602",
    "rajasthan": "26",
    "tamil nadu": "509",
    "telangana": "28",
    "tripura": "36",
    "uttar pradesh": "46",
    "uttarakhand": "385",
    "west bengal": "569",
}

STATE_ALIASES = {
    "up": "uttar pradesh",
    "u.p": "uttar pradesh",
    "mp": "madhya pradesh",
    "m.p": "madhya pradesh",
    "tn": "tamil nadu",
    "t.n": "tamil nadu",
    "wb": "west bengal",
    "ap": "andhra pradesh",
    "ts": "telangana",
    "jk": "jammu and kashmir",
}

MAX_LOOKBACK_DAYS = 7

# -------------------------------------------------------------------
# Helpers (pure Python)
# -------------------------------------------------------------------

def resolve_state_name(state_name: str) -> tuple[str | None, list[str]]:
    name = state_name.strip().lower().replace(".", "")
    name = STATE_ALIASES.get(name, name)

    if name in STATE_NAME_TO_ID:
        return name, []

    suggestions = difflib.get_close_matches(
        name, STATE_NAME_TO_ID.keys(), n=3, cutoff=0.6
    )
    return None, suggestions


def _body_excerpt(text: str, limit: int = 200) -> str:
    """Return first ``limit`` chars of ``text`` with non-printable chars trimmed."""
    cleaned = " ".join(text.split())
    return cleaned[:limit]


async def _safe_fetch_json(
    session: aiohttp.ClientSession,
    url: str,
    *,
    label: str,
    form: aiohttp.FormData | None = None,
    timeout: float = 20.0,
) -> dict:
    """
    Robustly POST to an eNAM endpoint and parse the JSON response.

    eNAM frequently returns HTML (challenge/captcha pages, maintenance banners,
    login pages) or non-2xx errors instead of JSON. Calling ``json.loads``
    blindly on such a body raises ``JSONDecodeError`` and crashes the MCP tool.

    This helper ALWAYS returns a dict so the caller can simply use
    ``result.get("status")`` / ``result.get("data")``. It NEVER fabricates
    records — on failure it returns a structured error envelope that the
    ``MarketNormaliser`` will treat as zero records.

    Success: ``{"status": 200, "data": <parsed-json>}``

    Non-success (any of): non-2xx, non-JSON ``Content-Type``,
    body that fails ``json.loads``. Always carries ``error``,
    ``content_type`` (when known), and ``body_excerpt``.
    """
    request_kwargs: dict = {"timeout": aiohttp.ClientTimeout(total=timeout)}
    if form is not None:
        request_kwargs["data"] = form

    try:
        async with session.post(url, **request_kwargs) as response:
            content_type = response.headers.get("Content-Type", "") or ""
            status = response.status
            text = await response.text()
    except aiohttp.ClientError as exc:
        return {
            "status": 0,
            "error": "network_error",
            "label": label,
            "message": f"{type(exc).__name__}: {exc}",
        }
    except Exception as exc:  # noqa: BLE001 — never crash the MCP tool
        return {
            "status": 0,
            "error": "fetch_exception",
            "label": label,
            "message": f"{type(exc).__name__}: {exc}",
        }

    if status >= 400:
        return {
            "status": status,
            "error": "http_error",
            "label": label,
            "content_type": content_type,
            "body_excerpt": _body_excerpt(text),
        }

    if "json" not in content_type.lower():
        return {
            "status": status,
            "error": "non_json_response",
            "label": label,
            "content_type": content_type,
            "body_excerpt": _body_excerpt(text),
        }

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return {
            "status": status,
            "error": "json_parse_error",
            "label": label,
            "content_type": content_type,
            "message": f"{type(exc).__name__}: {exc}",
            "body_excerpt": _body_excerpt(text),
        }

    return {"status": 200, "data": payload, "content_type": content_type}


# -------------------------------------------------------------------
# Internal business logic (NO decorators)
# -------------------------------------------------------------------

async def _get_apmc_list_from_enam(state_name: str) -> dict:
    resolved_state, suggestions = resolve_state_name(state_name)
    if not resolved_state:
        return {
            "status": 400,
            "error": f"Invalid state name: '{state_name}'",
            "suggestions": suggestions,
        }

    url = "https://enam.gov.in/web/Ajax_ctrl/apmc_list"
    form = aiohttp.FormData()
    form.add_field("state_id", STATE_NAME_TO_ID[resolved_state])

    async with aiohttp.ClientSession() as session:
        result = await _safe_fetch_json(
            session, url, label="apmc_list", form=form
        )
        if result.get("error") or result.get("status") != 200:
            return result

        payload = result["data"]
        apmcs = [
            item["apmc_name"]
            for item in payload.get("data", [])
            if "apmc_name" in item
        ]

        return {
            "status": 200,
            "state": resolved_state,
            "count": len(apmcs),
            "apmcs": apmcs,
        }


async def _get_commodity_list_from_enam(
    state_name: str, apmc_name: str, from_date: str, to_date: str
) -> dict:

    resolved_state, suggestions = resolve_state_name(state_name)
    if not resolved_state:
        return {
            "status": 400,
            "error": f"Invalid state name: '{state_name}'",
            "suggestions": suggestions,
        }

    apmc_resp = await _get_apmc_list_from_enam(resolved_state)
    if apmc_resp.get("error") or apmc_resp.get("status") != 200:
        return apmc_resp

    apmc_lookup = {a.lower(): a for a in apmc_resp["apmcs"]}
    apmc_key = apmc_name.strip().lower()

    if apmc_key not in apmc_lookup:
        return {
            "status": 400,
            "error": f"APMC '{apmc_name}' not available",
            "available_apmcs": apmc_resp["apmcs"],
        }

    standard_apmc = apmc_lookup[apmc_key]
    standard_state = resolved_state.upper()

    url = "https://enam.gov.in/web/Ajax_ctrl/commodity_list"

    found_data = []
    missing_dates = []
    found_date = None

    start_dt = datetime.strptime(to_date, "%Y-%m-%d")

    async with aiohttp.ClientSession() as session:
        upstream_error: dict | None = None
        for i in range(MAX_LOOKBACK_DAYS):
            date = (start_dt - timedelta(days=i)).strftime("%Y-%m-%d")

            form = aiohttp.FormData()
            form.add_field("language", "en")
            form.add_field("stateName", standard_state)
            form.add_field("apmcName", standard_apmc)
            form.add_field("fromDate", date)
            form.add_field("toDate", date)

            result = await _safe_fetch_json(
                session, url, label=f"commodity_list[{date}]", form=form
            )
            if result.get("error") or result.get("status") != 200:
                # eNAM returned HTML / parse error / 4xx / network error.
                # If upstream is consistently broken (e.g. blocked), every
                # date in the lookback window will fail the same way. Record
                # the first such error and keep trying the remaining dates,
                # but bail out immediately on hard network/parse errors since
                # retrying the same upstream is pointless.
                missing_dates.append(date)
                upstream_error = result
                err_code = result.get("error")
                if err_code in ("network_error", "fetch_exception", "json_parse_error", "http_error"):
                    # retrying the same upstream won't help
                    break
                continue

            payload = result["data"]
            rows = payload.get("data", []) if isinstance(payload, dict) else []

            if rows:
                found_data = rows
                found_date = date
                break
            missing_dates.append(date)

    if not found_data:
        # If every attempt hit an upstream error, return that error so the
        # caller can distinguish "no data on the requested date" from
        # "eNAM is blocked/broken".
        if upstream_error is not None and all(
            d == missing_dates[0] for d in missing_dates
        ) and len(missing_dates) <= 1:
            return upstream_error
        return {
            "status": 204,
            "state": standard_state,
            "apmc": standard_apmc,
            "checked_dates": missing_dates,
        }

    if not found_data:
        return {
            "status": 204,
            "state": standard_state,
            "apmc": standard_apmc,
            "checked_dates": missing_dates,
        }

    return {
        "status": 200,
        "state": standard_state,
        "apmc": standard_apmc,
        "available_date": found_date,
        "missing_dates": missing_dates,
        "commodities": found_data,
    }


async def _get_trade_data_list(
    state_name: str,
    apmc_name: str,
    commodity_name: str,
    from_date: str,
    to_date: str,
) -> dict:

    commodity_resp = await _get_commodity_list_from_enam(
        state_name, apmc_name, from_date, to_date
    )

    if commodity_resp.get("error") or commodity_resp.get("status") != 200:
        return commodity_resp

    available = {
        c["commodity"].lower(): c["commodity"]
        for c in commodity_resp["commodities"]
    }

    key = commodity_name.strip().lower()
    if key not in available:
        return {
            "status": 400,
            "error": f"Commodity '{commodity_name}' not available",
            "available_commodities": sorted(available.values()),
        }

    standard_commodity = available[key]
    standard_state = commodity_resp["state"]
    standard_apmc = commodity_resp["apmc"]

    url = "https://enam.gov.in/web/Ajax_ctrl/trade_data_list"

    start_dt = datetime.strptime(to_date, "%Y-%m-%d")
    missing_dates: list[str] = []
    upstream_error: dict | None = None

    async with aiohttp.ClientSession() as session:
        for i in range(MAX_LOOKBACK_DAYS):
            date = (start_dt - timedelta(days=i)).strftime("%Y-%m-%d")

            form = aiohttp.FormData()
            form.add_field("language", "en")
            form.add_field("stateName", standard_state)
            form.add_field("apmcName", standard_apmc)
            form.add_field("commodityName", standard_commodity)
            form.add_field("fromDate", date)
            form.add_field("toDate", date)

            result = await _safe_fetch_json(
                session, url, label=f"trade_data_list[{date}]", form=form
            )
            if result.get("error") or result.get("status") != 200:
                missing_dates.append(date)
                upstream_error = result
                err_code = result.get("error")
                # No point retrying the same upstream on a hard failure.
                if err_code in (
                    "network_error",
                    "fetch_exception",
                    "json_parse_error",
                    "http_error",
                ):
                    break
                continue

            payload = result["data"]
            rows = payload.get("data", []) if isinstance(payload, dict) else []

            if rows:
                return {
                    "status": 200,
                    "state": standard_state,
                    "apmc": standard_apmc,
                    "commodity": standard_commodity,
                    "available_date": date,
                    "missing_dates": missing_dates,
                    "trade_data": rows,
                }

            missing_dates.append(date)

    # If we get here with no rows and the very first attempt hit a hard
    # upstream error, surface that error instead of a generic 204 so the
    # backend can distinguish "no data" from "eNAM is broken".
    if (
        upstream_error is not None
        and len(missing_dates) == 1
        and upstream_error.get("error") in ("network_error", "fetch_exception")
    ):
        return upstream_error

    return {
        "status": 204,
        "state": standard_state,
        "apmc": standard_apmc,
        "commodity": standard_commodity,
        "checked_dates": missing_dates,
    }


# -------------------------------------------------------------------
# MCP tool wrappers (THIN ONLY)
# -------------------------------------------------------------------

@mcp.tool()
async def get_apmc_list_from_enam(state_name: str) -> dict:
    return await _get_apmc_list_from_enam(state_name)


@mcp.tool()
async def get_commodity_list_from_enam(
    state_name: str, apmc_name: str, from_date: str, to_date: str
) -> dict:
    return await _get_commodity_list_from_enam(
        state_name, apmc_name, from_date, to_date
    )


@mcp.tool()
async def get_trade_data_list(
    state_name: str,
    apmc_name: str,
    commodity_name: str,
    from_date: str,
    to_date: str,
) -> dict:
    return await _get_trade_data_list(
        state_name, apmc_name, commodity_name, from_date, to_date
    )


# -------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="0.0.0.0",
        port=9022,
    )
