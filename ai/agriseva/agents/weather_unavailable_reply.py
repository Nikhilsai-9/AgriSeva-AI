"""Deterministic terminal reply when live weather data is unavailable."""

from __future__ import annotations

from langchain_core.messages import AIMessage

from agriseva.agents.answer_footers import build_weather_unavailable_content
from agriseva.agents.state import AgriSevaState
from agriseva.agents.thread_logging import end_conversation_turn
from agriseva.agents.thread_trace import trace_event
from agriseva.agents.translation_catalog import language_pair_from_plan


async def weather_unavailable_reply_node(state: AgriSevaState) -> dict:
    """Return localized catalog text and testing notice without invoking an LLM."""
    script, vocal = language_pair_from_plan(state.get("plan"))
    content = build_weather_unavailable_content(script, vocal)

    trace_event(
        "weather_unavailable_reply",
        script_language=script,
        vocal_language=vocal,
    )
    end_conversation_turn(content, outcome="weather_unavailable")
    return {
        "messages": [AIMessage(content=content)],
        "location": state.get("location"),
    }
