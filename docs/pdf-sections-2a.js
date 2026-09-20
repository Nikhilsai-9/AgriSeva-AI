// Section 3: High-Level Architecture.
module.exports = [
  function s3(H) {
    H.H1("3. High-Level Architecture");
    H.P(
      "AgriSeva-AI is composed of four logical services. Each service can be deployed " +
      "independently; in production they are isolated networks connected through Tailscale and a " +
      "reverse proxy."
    );
    H.H3("3.1  The four services");
    H.KV([
      ["Frontend (browser)",  "Vite + React 19 + TypeScript. Static SPA, served by nginx in Docker, Firebase Hosting in prod."],
      ["Backend (API)",       "Express 5 + routing-controllers + InversifyJS. REST + JSON, JWT-validated by Firebase Admin SDK."],
      ["AI Agent (reasoning)","FastAPI + LangGraph supervisor + 6 subagents. Standard LangGraph HTTP+SSE."],
      ["MCP Tool Servers",    "11 FastMCP servers, each one a domain (weather, market, soil, schemes, …). Accessed by the agent via MCP-over-HTTP, not by import."],
    ]);
    H.H3("3.2  Request flow — a farmer question");
    H.bullet([
      "Farmer texts the WhatsApp number, speaks to the Plivo line, or opens the web UI.",
      "Frontend (or WhatsApp/Plivo service) opens an HTTP/SSE stream to the AI Agent.",
      "Supervisor agent classifies the query and dispatches to one or more subagents.",
      "Subagents call MCP tools (Agmarknet for mandi prices, IMD for weather, …) or hit GDB/POP RAG.",
      "Synthesizer returns a draft answer; reviewer system logs it for the human-in-the-loop pipeline.",
      "Same synthesizer path is used by the reviewer console and the WhatsApp-bot.",
    ], true);
    H.H3("3.3  Logical diagram");
    H.CODE(
      "+------------+    +---------------+    +------------------+    +--------------------+\n" +
      "|  Farmers   |    |  Reviewers    |    |  Field Staff     |    |  Admins            |\n" +
      "| (web/voice/|    |  (console)    |    |  (coordinators)  |    |  (console)         |\n" +
      "|  WhatsApp) |    |               |    |                  |    |                    |\n" +
      "+-----+------+    +-------+-------+    +---------+--------+    +----------+---------+\n" +
      "      |                   |                      |                        |\n" +
      "      v                   v                      v                        v\n" +
      "+------------------------------------------------------------------------------+\n" +
      "|  FRONTEND  ·  Vite/React/TS  ·  Firebase client auth                        |\n" +
      "+---------------------------------+--------------------------------------------+\n" +
      "                                  | VITE_API_BASE_URL (REST + SSE)\n" +
      "                                  v\n" +
      "+------------------------------------------------------------------------------+\n" +
      "|  BACKEND  ·  Express 5  ·  routing-controllers  ·  Firebase Admin           |\n" +
      "|  MongoDB Atlas  ·  WebSocket (Plivo)  ·  23 modules                         |\n" +
      "+---------------------------------+--------------------------------------------+\n" +
      "                                  | HTTP / Tailscale (REMOTE_IP)\n" +
      "                                  v\n" +
      "+------------------------------------------------------------------------------+\n" +
      "|  AI AGENT  ·  LangGraph  ·  Claude  ·  Supervisor + 6 subagents             |\n" +
      "|  Planner orchestrator  ·  Synthesizer  ·  Reviewer handoff                  |\n" +
      "+---------------------------------+--------------------------------------------+\n" +
      "                                  | MCP-over-HTTP (one URL per tool server)\n" +
      "                                  v\n" +
      "+------------------------------------------------------------------------------+\n" +
      "|  MCP SERVERS  ·  11 services  ·  FastMCP                                    |\n" +
      "| agmarknet · eNAM · IMD weather · soil · POP · GDB · schemes · chemicals …   |\n" +
      "+------------------------------------------------------------------------------+"
    );
  },
];
