// Section 22: PENDING / Blockers / Roadmap.
module.exports = [
  function s22(H) {
    H.H1("22. Pending — Backlog, Blockers, Roadmap");
    H.P(
      "This is the explicit, honest list of work that is NOT done. Every row has an owner, a blocker, " +
      "and the next concrete step that should be taken. The owner is the project owner unless stated otherwise."
    );
    H.TABLE(
      ["#", "Item", "Category", "Blocker / What's needed", "Next step"],
      [
        ["1",  "Real payment gateway",                          "Farmer flow",      "PSP choice (Razorpay / Stripe / Cashfree) + merchant KYC",  "Pick PSP, get API keys, write PaymentService.realizeCharge()"],
        ["2",  "Buyer KYC integration",                         "Farmer flow",      "KYC vendor (Setu / Signzy) + agreement",                    "Vendor selection, then catalogue sync via BuyerService.refreshKyc()"],
        ["3",  "Real warehouse / cold-storage API",             "Farmer flow",      "Partner warehouse API",                                       "Establish partner contract; replace seeded storage_options"],
        ["4",  "Logistics provider API integration",            "Farmer flow",      "Logistics aggregator (Shiprocket / Delhivery)",              "Partner choice, then integrate booking + tracking"],
        ["5",  "Reduce LLM involvement for matched GDB queries","AI perf",          "Decision-tree shortcut in plan_executor",                    "Add if exact_match: skip_synthesis branch"],
        ["6",  "Propagate location to subagents",               "AI perf",          "Subagent prompts + context plumbing",                        "Pass state.user_location into every subagent invoke"],
        ["7",  "STT coverage for rarer languages",              "AI / voice",       "Sarvam language model versions + per-language WS tuning",    "Add per-language STT test matrix + tune confidence thresholds"],
        ["8",  "Migrate remaining 6 legacy cron jobs to Cloud Run","Infra",         "Same pattern as backup-db / gate-keeper-auditor-queue",      "Add per-job blocks to .github/workflows/cloudrun-jobs-deployment.yml"],
        ["9",  "Add dashboard.tabs* + sidebar keys to 22 locale files","i18n",     "Batch translation pass",                                      "Export missing keys, route to translation vendor, ingest"],
        ["10", "Admin moderation policy engine (audit + flagsReported)","Ops",    "Product rule set + UI surface",                              "Spec out /audit rule editor, ship behind feature flag"],
        ["11", "Visual regression tests for responsive shell","Frontend QA",        "Playwright snapshots at 360 / 768 / 1280 / 1440",            "Wire Playwright, baseline, embed in CI"],
        ["12", "End-to-end test against real Firebase + Atlas","QA",                "Test infra with private sandbox cluster",                     "Set up ephemeral Atlas + Firebase emulator in CI"],
        ["13", "Coordinator audit + reporting enhancements",    "Field ops",        "Aggregation pipeline for district/block scorecards",         "Spec out the report schema, add DashboardService.coordinatorReport"],
        ["14", "Public landing page A/B test",                   "Growth",            "Marketing experiment harness",                                "Pick AB framework (PostHog), wire up"],
        ["15", "Mobile app (React Native)",                     "Client expand",    "Bundle budget + design",                                      "Decide whether RN or PWWA; design for low-end Android"],
      ],
      { widths: [30, 200, 90, 200, 200] }
    );
  },
];
