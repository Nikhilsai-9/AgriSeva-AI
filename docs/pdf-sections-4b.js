// Section 7 part 2: layout, cross-cutting, auth hardening.
module.exports = [
  function s7b(H) {
    H.H2("7.2  Per-module file layout (conventional)");
    H.UL([
      "controllers/    — routing-controllers decorated classes (@JsonController, @Get, @Post).",
      "services/       — business logic, transactions, side effects.",
      "repositories/   — Mongo access (one repository per collection).",
      "validators/     — class-validator DTOs.",
      "tests/          — Vitest suites (controllers + services).",
      "transformers/   — class-transformer interceptors.",
    ]);
    H.H2("7.3  Cross-cutting concerns");
    H.UL([
      "CORS driven by APP_ORIGINS env var; no other allow-lists.",
      "All authenticated endpoints use @Authorized() + @CurrentUser() from routing-controllers.",
      "Errors are normalised by a single Express error middleware in src/shared/middleware.",
      "All write paths log to auditTrails; reads log PII-safe summaries via utils/logDetails.ts.",
      "Generated OpenAPI spec is consumed by the frontend's openapi-ts to produce src/client/*.",
    ]);
    H.H2("7.4  Auth + persistence hardening on farmer/transaction");
    H.P("Recent (this edition) — see FARMER_SYSTEM_AUTH_PERSISTENCE_HARDENING.md:");
    H.TABLE(
      ["Controller", "Auth model", "Ownership checks", "Notification fan-out"],
      [
        ["LotController",       "JWT", "user._id",        "lot_created / lot_updated"],
        ["OfferController",     "JWT", "lot owner check", "offer_received / offer_accepted / offer_rejected"],
        ["PaymentController",   "JWT", "owner check",     "payment_recorded"],
        ["GrievanceController", "JWT", "owner check",     "grievance_created"],
        ["StorageController",   "JWT", "owner check",     "storage_booked"],
        ["LogisticsController", "JWT", "owner check",     "logistics_booked"],
        ["BuyerController",     "JWT", "owner check",     "(none)"],
        ["UserController",      "JWT", "self-only PATCH /users/me/farmer-profile", "n/a"],
      ],
      { widths: [120, 60, 130, 200] }
    );
    H.UL([
      "Removed x-demo-farmer-id trust header from every endpoint and frontend client.",
      "Added IFarmerProfile sub-doc + FarmerProfilePatchDto with merge semantics + array dedup.",
      "Added PATCH /api/users/me/farmer-profile for the editable profile UI.",
      "NotificationService now fires real events so the notifications bell mirrors backend truth.",
      "New test files: TransactionAuth.test.ts (9/9), UserProfile.test.ts (5/5), NotificationFlow.test.ts (4/4).",
      "Net diff: 15 files modified, +876 / -177 lines.",
    ]);
  },
];
