"""Tests for question_source resolution (config vs .env)."""

import os
from unittest.mock import patch

from agriseva.agents.config import resolve_question_source


def test_resolve_prefers_configurable():
    cfg = {"configurable": {"question_source": "WHATSAPP"}}
    with patch("agriseva.agents.config.QUESTION_SOURCE", "AGRISEVA_AI"):
        assert resolve_question_source(cfg) == "WHATSAPP"


def test_resolve_falls_back_to_env():
    with patch.dict("os.environ", {"QUESTION_SOURCE": "AGRISEVA_AI_WEBAPP"}, clear=False):
        assert resolve_question_source({}) == "AGRISEVA_AI_WEBAPP"
        assert resolve_question_source(None) == "AGRISEVA_AI_WEBAPP"


def test_resolve_empty_configurable_uses_env():
    cfg = {"configurable": {"question_source": "  "}}
    with patch.dict("os.environ", {"QUESTION_SOURCE": "AGRISEVA_AI"}, clear=False):
        assert resolve_question_source(cfg) == "AGRISEVA_AI"
