// Section 8 part 1: AI Agent — file tree + status.
module.exports = [
  function s8a(H) {
    H.H1("8. AI Agent — LangGraph Supervisor + Subagents");
    H.P(
      "The AI Agent is a Python service: FastAPI for transport, LangGraph for orchestration, " +
      "Anthropic Claude for the reasoning LLM, and self-hosted MiniMax / Gemma for special-purpose " +
      "subagents. It is reachable over a standard LangGraph HTTP+SSE API so any client (WhatsApp, " +
      "voice, ChatUI, future) can plug in unchanged."
    );
    H.H2("8.1  Files");
    H.CODE(
      "ai/agriseva/agents/\n" +
      "|-- agriseva.py                # Graph entrypoint + compiled `graph`\n" +
      "|-- state.py                   # AgentState schema (Pydantic)\n" +
      "|-- planner.py                 # Planner orchestrator (USE_PLANNER_GRAPH=true)\n" +
      "|-- planner_rules.py           # Rule-based short-circuits\n" +
      "|-- plan_executor.py           # Plan execution loop\n" +
      "|-- prompts.py                 # System + per-agent prompts\n" +
      "|-- domains.py                 # Domain tagging for routing\n" +
      "|-- config.py                  # Model + endpoint config\n" +
      "|-- language.py                # Language detection + Sarvam invocation\n" +
      "|-- translate_answer.py        # Answer translation\n" +
      "|-- synthesis/                 # Final answer assembly (12 files)\n" +
      "|-- subagents/                 # GDB, weather, market, soil, schemes, chemicals\n" +
      "|-- support/                   # memory, logging, trace, retrieval, registry\n" +
      "`-- tests/                     # Unit tests for routing, planner, etc."
    );
    H.H2("8.2  Status of every major capability (from ai/README.md)");
    H.TABLE(
      ["Capability", "Status", "Notes"],
      [
        ["Supervisor + subagent pattern",          "✅ Done",            "Main agent orchestrates GDB, weather, market, soil, schemes, chemicals."],
        ["Planner orchestrator",                    "✅ Done & stable",   "USE_PLANNER_GRAPH=true (default); planner -> execute_plan -> synthesize."],
        ["Translation (Sarvam)",                    "✅ Done & stable",   "Indian-language answers with source-English fallback."],
        ["Speech-to-Text (Sarvam)",                 "⚠ Partial",         "Pipeline works for some languages; broader coverage required."],
        ["Voice (Plivo PSTN -> LangGraph agent)",   "✅ Done & stable",   "Streaming via backend WS, transcription in browser."],
        ["WhatsApp Cloud API integration",          "✅ Done & stable",   "Farmer -> WhatsApp -> backend chatbot module -> AI agent."],
        ["Manure / fertilizer recom.",              "⚠ Partial",         "Recommendation heuristic live; richer agronomy integration pending."],
        ["Government Schemes tool",                 "✅ Done & stable",   "Demographics-driven matching through MCP."],
        ["Soil Health Card API integration",        "✅ Done & stable",   "Fertilizer dosage from soilhealth.dac.gov.in."],
        ["Location capture in main agent state",    "✅ Done",            "GPS / pincode resolved to state + district."],
        ["Location passed to subagents",            "⚠ Partial",         "Captured but not yet propagated into subagent context."],
        ["Reduce LLM for matched queries",          "❌ Not started",     "Exact-match GDB hits should bypass synthesis."],
      ],
      { widths: [220, 110, 220] }
    );
  },
];
