// Section 10: Database schema.
module.exports = [
  function s10(H) {
    H.H1("10. Database Schema");
    H.P(
      "Two engines are in play: MongoDB Atlas for the operational + analytics data, and PostgreSQL " +
      "(asyncpg) for LangGraph checkpoint state. Vector search uses MongoDB Atlas Vector Search over " +
      "the `goldenDataset` collection. Each collection has a repository wrapper in the matching backend " +
      "module."
    );
    H.H2("10.1  MongoDB — collections");
    H.TABLE(
      ["Collection", "Owner module", "Purpose"],
      [
        ["users",                       "user",              "Firebase-anchored user records + farmerProfile sub-doc"],
        ["questions",                   "question",          "Incoming farmer questions"],
        ["answers",                     "answer",            "Approved answers"],
        ["requestfeedbacks",            "request",           "User feedback on answers"],
        ["contexts",                    "context",           "Per-call context records"],
        ["notifications",               "notification",      "In-app + push notification fan-out log"],
        ["auditTrails",                 "auditTrails",       "Append-only audit log"],
        ["comments",                    "comment",           "Threaded comments on questions"],
        ["crops",                       "crop",              "Crop master"],
        ["chemicals",                   "chemical",          "Chemical + banned registry"],
        ["marketPriceSnapshots",        "marketIntelligence","Agmarknet + eNAM daily snapshots"],
        ["lots",                        "transaction",       "Farmer grain lots for sale"],
        ["offers",                      "transaction",       "Buyer offers on lots"],
        ["payments",                    "transaction",       "Payment transactions (records, no gateway)"],
        ["buyers",                      "transaction",       "Buyer catalogue (demo seed)"],
        ["grievances",                  "transaction",       "Farmer support tickets"],
        ["storage_options",             "transaction",       "Storage facilities catalogue (seed)"],
        ["storage_bookings",            "transaction",       "Storage bookings"],
        ["logistics_options",           "transaction",       "Logistics provider catalogue (seed)"],
        ["logistics_bookings",          "transaction",       "Logistics bookings"],
        ["whatsappThreads",             "whatsapp",          "Per-conversation thread log"],
        ["lgd_states | districts | blocks | villages", "lgd", "India LGD sync tables"],
        ["schemes",                     "(MCP)",             "Government schemes catalogue"],
        ["goldenDataset",               "(MCP)",             "Curated vector-search knowledge base"],
      ],
      { widths: [200, 120, 220] }
    );
    H.H2("10.2  PostgreSQL — LangGraph checkpoint store");
    H.UL([
      "Stores conversation state and agent memory.",
      "Configured via DATABASE_URL; reachable on the Docker network at ai-postgres:5432.",
      "Connection limit + pool tuning per deployment.",
    ]);
  },
];
