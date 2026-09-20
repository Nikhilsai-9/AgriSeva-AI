// Section 9: MCP Tool Servers.
module.exports = [
  function s9(H) {
    H.H1("9. MCP Tool Servers");
    H.P(
      "Eleven FastMCP servers run as independent processes/containers. The AI Agent reaches them at " +
      "runtime through an MCP client over HTTP — never by import. This keeps each tool server's " +
      "deployment independent and lets us add or replace tools without modifying the agent."
    );
    H.TABLE(
      ["Server", "Domain", "Backing API / Data"],
      [
        ["agmarknet-mcp",          "Mandi prices (primary)",       "agmarknet.gov.in"],
        ["market",                 "Mandi prices (alt)",           "Agmarknet cache + eNAM"],
        ["imd_weather",            "Weather",                       "India Meteorological Department"],
        ["weather",                "Weather (alt. harness)",        "OpenWeather + IMD"],
        ["soil-health-mcp",        "Fertilizer dosage",            "soilhealth.dac.gov.in"],
        ["pop",                    "Package of Practices",         "KVK catalogues"],
        ["pop_v2",                 "PoP v2 (richer structure)",    "KVK catalogues"],
        ["golden_dataset",         "RAG — expert answers",         "MongoDB Atlas Vector Search"],
        ["faq",                    "FAQ document lookup",           "Internal"],
        ["review-search-mcp",      "Review history search",         "Reviewer console backend"],
        ["reviewer_system",        "Reviewer workflow",             "Reviewer console backend"],
        ["other_markets (unified)","Unified mandi price scraper",  "Agmarknet + eNAM"],
      ],
      { widths: [150, 140, 240] }
    );
    H.H2("9.1  Tool calling pattern");
    H.P(
      "The supervisor classifies a query, then dispatches to the relevant subagent(s). Each subagent is " +
      "a dedicated LLM ReAct loop with access only to its own MCP server(s). The subagent returns a clean " +
      "result to the supervisor, which passes it to the synthesizer for the final answer."
    );
  },
];
