// Section 14 part 2: Farmer dashboard full route map.
module.exports = [
  function s14b(H) {
    H.H2("14.5  Farmer — full route map with data-source verdicts");
    H.TABLE(
      ["#", "Route", "Verdict", "Source of truth"],
      [
        ["1",  "/farmer",                        "PARTIAL",   "Aggregates below. Banner copy reflects the mixed boundary."],
        ["2",  "/farmer/prices",                 "REAL",      "Agmarknet + eNAM MCP -> marketPriceSnapshots -> REST."],
        ["3",  "/farmer/buyers",                 "PARTIAL",   "Real MongoDB persistence, seeded catalogue."],
        ["4",  "/farmer/buyers/:buyerId",        "PARTIAL",   "Real market prices x seeded buyers; match scoring is real."],
        ["5",  "/farmer/lots",                   "PARTIAL",   "Real MongoDB writes, seeded on first boot."],
        ["6",  "/farmer/lots/new",               "PARTIAL",   "POST persists; auth via JWT (x-demo-farmer-id removed)."],
        ["7",  "/farmer/lots/:lotId",            "PARTIAL",   "Real offers cascade; ownership enforced."],
        ["8",  "/farmer/offers",                 "PARTIAL",   "Accept cascade via OfferService (offer -> accept -> reject siblings -> mark sold -> materialize payment)."],
        ["9",  "/farmer/payments",               "PARTIAL",   "Records only, no payment gateway."],
        ["10", "/farmer/grievances",             "PARTIAL",   "Real Mongo; owner-scoped; lot owner notified."],
        ["11", "/farmer/storage",                "PARTIAL",   "Real Mongo options/bookings; seeded catalogue."],
        ["12", "/farmer/logistics",              "PARTIAL",   "Real Mongo options/bookings; seeded catalogue."],
        ["13", "/farmer/profile",                "REAL",      "PATCH /api/users/me/farmer-profile — persisted per authenticated user."],
        ["14", "Bell notifications",             "REAL",      "GET /api/notifications — real backend events, not synthetic."],
        ["15", "/farmer/recommend",              "PARTIAL",   "Buyer match scoring on real MCP mandi prices."],
      ],
      { widths: [30, 140, 65, 280] }
    );
    H.P(
      "Two production-critical gaps remain explicitly NOT magic-ed away:"
    );
    H.bullet([
      "Auth bypass (was: x-demo-farmer-id). Status: now resolved in this edition (see FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md).",
      "Buyer KYC. Status: not in scope. The buyer directory is seeded; KYC integration is a follow-up.",
    ], true);
  },
];
