// Section 6 part 1: Frontend dev flow + route map.
module.exports = [
  function s6a(H) {
    H.H1("6. Frontend — Vite + React + TypeScript");
    H.H2("6.1  Stack & dev flow");
    H.UL([
      "`pnpm install` from frontend/ to install.",
      "`pnpm run dev` runs Vite on port 5173 with HMR.",
      "`pnpm run build` produces the static bundle and runs TypeScript validation.",
      "`pnpm run test` runs Vitest suites.",
      "`pnpm run openapi-ts` regenerates the typed API client from the backend's OpenAPI.",
    ]);
    H.H2("6.2  File-based route map (28 authenticated + public)");
    H.P(
      "Routes live in frontend/src/routes/ and follow the TanStack Router convention " +
      "`_authenticated.<segment>.tsx`. The shell enforces auth and renders the global nav."
    );
    H.TABLE(
      ["Route", "File", "Roles", "Purpose"],
      [
        ["/",                          "_root + index.tsx",                 "public",       "Landing"],
        ["/auth",                      "_auth.tsx",                        "public",       "Sign-in / register"],
        ["/home",                      "_authenticated.home.tsx",          "all except farmer/pae/coordinators", "Main dashboard"],
        ["/farmer",                    "_authenticated.farmer.tsx",        "farmer",       "Farmer sub-layout"],
        ["/farmer (home)",             "_authenticated.farmer.index.tsx",  "farmer",       "Farmer dashboard home"],
        ["/farmer/prices",             "_authenticated.farmer.prices.tsx", "farmer",       "Live mandi prices"],
        ["/farmer/buyers",             "_authenticated.farmer.buyers.tsx", "farmer",       "Buyers directory"],
        ["/farmer/buyers/:buyerId",    "_authenticated.farmer.buyers.$buyerId.tsx", "farmer", "Buyer detail"],
        ["/farmer/lots",               "_authenticated.farmer.lots.tsx",   "farmer",       "My lots"],
        ["/farmer/lots/new",           "_authenticated.farmer.lots.new.tsx","farmer",      "Create a lot"],
        ["/farmer/lots/:lotId",        "_authenticated.farmer.lots.$lotId.tsx","farmer",    "Lot detail + offers"],
        ["/farmer/offers",             "_authenticated.farmer.offers.tsx", "farmer",       "All offers"],
        ["/farmer/payments",           "_authenticated.farmer.payments.tsx","farmer",      "Transactions (records)"],
        ["/farmer/grievances",         "_authenticated.farmer.grievances.tsx","farmer",     "Support grievances"],
        ["/farmer/storage",            "_authenticated.farmer.storage.tsx","farmer",       "Storage booking"],
        ["/farmer/logistics",          "_authenticated.farmer.logistics.tsx","farmer",     "Logistics booking"],
        ["/farmer/profile",            "_authenticated.farmer.profile.tsx","farmer",       "Farmer profile (editable)"],
        ["/farmer/recommend",          "_authenticated.farmer.recommend.tsx","farmer",     "Compare buyers"],
        ["/whatsapp-history",          "_authenticated.whatsapp-history.tsx","except call_agent","Conversation history viewer"],
        ["/chatbot",                   "_authenticated.chatbot.tsx",       "admin / moderator", "ChatBot analytics"],
        ["/notifications",             "_authenticated.notifications.tsx", "all",          "Notification centre"],
        ["/audit",                     "_authenticated.audit.tsx",         "admin/auditor/gate_keeper", "Audit trail"],
        ["/flags-reported",            "_authenticated.flags-reported.tsx","admin/mod/auditor/gate_keeper", "Flagged question queue"],
        ["/history",                   "_authenticated.history.tsx",       "admin/mod/expert", "Submission history"],
        ["/pae-expert",                "_authenticated.pae-expert.tsx",    "pae_expert",   "PAE-Expert authoring"],
        ["/coordinator",               "_authenticated.coordinator.tsx",   "coordinator roles", "Field ops home"],
        ["/coordinator/profile",       "_authenticated.coordinator.profile.tsx","coordinator roles","Coordinator profile"],
        ["/user/:userId",              "_authenticated.user.$userId.tsx",  "admin/mod/tester", "User profile"],
        ["/user/:userId/history",      "_authenticated.user-history.$userId.tsx","admin/mod", "Per-user history"],
      ],
      { widths: [165, 200, 110, 165] }
    );
  },
];
