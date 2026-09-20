// Sections 11 + 12: Localization + Auth.
module.exports = [
  // 11 Localization
  function s11(H) {
    H.H1("11. Localization — 22 Indian Languages");
    H.P(
      "The UI ships with locale packs for 22 Indian languages. Every visible string is looked up via " +
      "useTranslation -> t(key, fallback) so missing keys fall back to the English string embedded in " +
      "the source. This makes the app readable end-to-end in every language, even when a specific key " +
      "hasn't been translated yet."
    );
    H.TABLE(
      ["ISO 639", "Language", "File", "Status"],
      [
        ["en",   "English",          "en.ts",  "✅ Complete"],
        ["hi",   "Hindi",            "hi.ts",  "✅ Complete"],
        ["bn",   "Bengali",          "bn.ts",  "✅ Complete"],
        ["ta",   "Tamil",            "ta.ts",  "✅ Complete"],
        ["te",   "Telugu",           "te.ts",  "✅ Complete"],
        ["kn",   "Kannada",          "kn.ts",  "✅ Complete"],
        ["ml",   "Malayalam",        "ml.ts",  "✅ Complete"],
        ["mr",   "Marathi",          "mr.ts",  "✅ Complete"],
        ["gu",   "Gujarati",         "gu.ts",  "✅ Complete"],
        ["pa",   "Punjabi",          "pa.ts",  "✅ Complete"],
        ["or",   "Odia",             "od.ts",  "✅ Complete"],
        ["ur",   "Urdu",             "ur.ts",  "✅ Complete"],
        ["as",   "Assamese",         "as.ts",  "✅ Complete"],
        ["mai",  "Maithili",         "mai.ts", "✅ Complete"],
        ["sd",   "Sindhi",           "sd.ts",  "✅ Complete"],
        ["ks",   "Kashmiri",         "ks.ts",  "✅ Complete"],
        ["doi",  "Dogri",            "doi.ts", "✅ Complete"],
        ["kok",  "Konkani",          "kok.ts", "✅ Complete"],
        ["mni",  "Manipuri (Meitei)","mni.ts", "✅ Complete"],
        ["sa",   "Sanskrit",         "sa.ts",  "✅ Complete"],
        ["sat",  "Santali",          "sat.ts", "✅ Complete"],
        ["brx",  "Bodo",             "brx.ts", "✅ Complete"],
      ],
      { widths: [60, 140, 80, 80] }
    );
    H.P(
      "Note on the brand new sidebar/header labels: the i18n keys (dashboard.openMenu, closeMenu, " +
      "expandNav, collapseNav, globalNav, tabs*) are added on demand by the UI's t() with English " +
      "fallback strings, so the UI never breaks before the next batch translation pass."
    );
  },

  // 12 Auth & AuthZ
  function s12(H) {
    H.H1("12. Authentication & Authorization");
    H.P(
      "Firebase Auth is the single identity provider for web users. The WhatsApp/PSTN channels issue " +
      "their own tokens that the backend exchanges for short-lived session JWTs. All API endpoints " +
      "(except /api/health, /api/auth/* and the OpenAPI doc) require a valid bearer token."
    );
    H.H3("12.1  JWT verification");
    H.UL([
      "Firebase Admin SDK validates the Authorization: Bearer <token> header on every protected route.",
      "Token claims (uid, email, email_verified, custom:role) populate req.user.",
      "routing-controllers' @CurrentUser() decorator exposes the principal.",
      "@Authorized() is used on every controller method that needs auth; ownership checks are added inline.",
    ]);
    H.H3("12.2  Cross-user authorisation");
    H.TABLE(
      ["Failure", "Returned status", "Reason"],
      [
        ["Missing / invalid / expired token",            "401 Unauthorized", "No principal resolved"],
        ["Authenticated but wrong owner",                "403 Forbidden",    "Cross-user access attempt"],
        ["Disabled / disallowed method",                  "405 Method Not Allowed", "Express default"],
        ["Malformed body / validation failure",          "400 Bad Request",  "class-validator pipeline"],
      ],
      { widths: [200, 110, 220] }
    );
    H.H3("12.3  Auth for the WhatsApp / Plivo channels");
    H.UL([
      "WhatsApp channel uses the channel-internal user id from the chatbot module's mapping table.",
      "Plivo voice channel issues a per-call short-lived JWT that expires after call end.",
      "INTERNAL_API_KEY env var guards service-to-service calls (e.g. AI agent -> backend audit logging).",
    ]);
  },
];
