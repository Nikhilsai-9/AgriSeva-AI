"""Deterministic terminal reply for non-agriculture queries."""

from __future__ import annotations

from langchain_core.messages import AIMessage

from agriseva.agents.answer_footers import build_non_agriculture_content
from agriseva.agents.state import AgriSevaState
from agriseva.agents.thread_logging import end_conversation_turn
from agriseva.agents.thread_trace import trace_event
from agriseva.agents.translation_catalog import language_pair_from_plan


async def non_agriculture_reply_node(state: AgriSevaState) -> dict:
    """Return the catalogue reply and testing notice without invoking an LLM."""
    script, vocal = language_pair_from_plan(state.get("plan"))
    content = build_non_agriculture_content(script, vocal)

    trace_event(
        "non_agriculture_reply",
        script_language=script,
        vocal_language=vocal,
    )
    end_conversation_turn(content, outcome="non_agriculture")
    return {
        "messages": [AIMessage(content=content)],
        "location": state.get("location"),
    }
