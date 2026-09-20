// Section 7 part 1: Backend — modules list.
module.exports = [
  function s7a(H) {
    H.H1("7. Backend — Express 5 + Routing-Controllers");
    H.P(
      "The backend is a TypeScript Express 5 server that uses routing-controllers for declarative " +
      "endpoints, InversifyJS for DI, and Firebase Admin for auth. It compiles to ESM and is run " +
      "with `node build/index.js` in production."
    );
    H.H2("7.1  Modules — 23 in total");
    H.TABLE(
      ["#", "Module", "Responsibility"],
      [
        ["1",  "acc-agent",               "Human-in-the-loop ACC agent integration"],
        ["2",  "ai",                      "Proxy to the LangGraph AI agent over HTTP"],
        ["3",  "answer",                  "Answer creation, edits, versioning"],
        ["4",  "auditTrails",             "Tamper-evident audit logs"],
        ["5",  "auth",                    "Firebase-based authentication, OAuth callback"],
        ["6",  "chatbot",                 "WhatsApp/voice chatbot integration"],
        ["7",  "chemical",                "Chemical/pesticide registry + banned check"],
        ["8",  "comment",                 "Threaded comments on questions"],
        ["9",  "context",                 "Per-call context records"],
        ["10", "core",                    "Core utilities, base controller"],
        ["11", "crop",                    "Crop catalogue"],
        ["12", "dashboard",               "Analytics aggregations"],
        ["13", "lgd",                     "LGD (states/districts/blocks/villages) sync"],
        ["14", "marketIntelligence",      "Agmarknet + eNAM price ingestion & REST"],
        ["15", "notification",            "Push / in-app notifications"],
        ["16", "performance",             "Reviewer performance metrics"],
        ["17", "plivo",                   "Plivo voice call handling"],
        ["18", "question",                "Core Q&A review workflow"],
        ["19", "request",                 "Generic request feedback"],
        ["20", "reroute",                 "Question re-routing between reviewers"],
        ["21", "transaction",             "Lots, offers, payments, grievances, buyers, storage, logistics"],
        ["22", "user",                    "Users, roles, farmer profile sub-doc"],
        ["23", "whatsapp",                "WhatsApp webhook"],
      ],
      { widths: [30, 130, 300] }
    );
  },
];
