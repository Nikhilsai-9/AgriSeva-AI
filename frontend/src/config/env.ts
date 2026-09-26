import { resolveEnv } from "./runtime-env";

/* -------------------------------------------------------------------------- */
/* SECRET HANDLING POLICY                                                     */
/* -------------------------------------------------------------------------- */
/* Vite inlines any VITE_* variable referenced at build time into the JS      */
/* bundle. Anything shipped to the browser is, by construction, public.      */
/*                                                                            */
/* Safe to expose (already public by design):                                */
/*   - VITE_FIREBASE_*          Firebase web SDK config — the Firebase docs  */
/*                              and code samples explicitly publish these.   */
/*                              Security is enforced by Firebase Security    */
/*                              Rules, not by hiding the config.             */
/*   - VITE_VAPID_PUBLIC_KEY    VAPID public key by design.                  */
/*   - VITE_API_BASE_URL        Public URL of the public REST gateway.       */
/*   - VITE_PLIVO_*_USERNAME    SIP endpoint/agent usernames (SIP login     */
/*                              identifiers, not secrets).                   */
/*   - VITE_PLIVO_STREAM_URL    Public wss: stream URL.                      */
/*                                                                            */
/* Sensitive — NEVER bake into the bundle:                                   */
/*   - VITE_SARVAM_API_KEY      Sarvam STT/TTS. The browser-side use was    */
/*                              originally a fallback; in production all     */
/*                              Sarvam calls go through the backend          */
/*                              PlivoService. The key is kept out of build. */
/*   - VITE_INTERNAL_API_KEY    Backend service-to-service token. Must not  */
/*                              be exposed to the browser; rotate if it was. */
/*   - VITE_PLIVO_*_PASSWORD    SIP endpoint/agent passwords. If you ever    */
/*                              need them in the browser (only for incoming  */
/*                              call UI), pass them via /runtime-config.js   */
/*                              at container start, never via VITE_*.        */
/* -------------------------------------------------------------------------- */

type EnvKeyPublic =
  // Common
  | "VITE_ENABLE_MOCKS"
  | "VITE_API_BASE_URL"

  // Firebase (public by design)
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID"

  // Web Push (VAPID public is safe; private must stay backend-only)
  | "VITE_VAPID_PUBLIC_KEY"

  // Plivo SIP — usernames/stream URL only. Passwords are runtime-injected.
  | "VITE_PLIVO_ENDPOINT_USERNAME"
  | "VITE_PLIVO_STREAM_URL"
  | "VITE_PLIVO_AGENT_1_USERNAME"
  | "VITE_PLIVO_AGENT_2_USERNAME"
  | "VITE_PLIVO_AGENT_3_USERNAME"
  | "VITE_PLIVO_AGENT_4_USERNAME"
  | `VITE_PLIVO_${string}_USERNAME`

  // Helpline & WhatsApp Integration
  | "VITE_AGRISEVA_HELPLINE_NUMBER"
  | "VITE_WHATSAPP_NUMBER"

  // FAQ / POP processing servers
  | "VITE_FAQ_API_URL"
  | "VITE_POP_API_URL";

/* The following VITE_* names are intentionally accepted ONLY because        */
/* `runtime-config.js` injects them at container start. They are NOT built    */
/* into the bundle because `getEnv` only returns the build-time value if the */
/* runtime injection is absent (see ./runtime-env.ts). Treat as secrets.     */
type RuntimeOnlySecretKey =
  | "VITE_PLIVO_ENDPOINT_PASSWORD"
  | `VITE_PLIVO_${string}_PASSWORD`;

/* Permissive union covers (a) documented client vars, (b) runtime-only       */
/* secrets, so existing code paths that wire them through `resolveEnv` /      */
/* `getEnv` (notably IncomingCallBox for the SIP endpoint) still type-check. */
/*                                                                        */
/* NOTE: `VITE_SARVAM_API_KEY` and `VITE_INTERNAL_API_KEY` are intentionally */
/* NOT in the union. If a future code change reintroduces them, TypeScript    */
/* will surface an error here instead of silently shipping them. */
type EnvKey = EnvKeyPublic | RuntimeOnlySecretKey;

/**
 * Internal getter (single source of truth)
 */
function getEnv(key: EnvKey, required = true, fallback = ""): string {
  try {
    const value = resolveEnv(key, import.meta.env[key]);

    if (!value && required) {
      alert(`Missing required environment variable: ${key}`);
    }

    return value || fallback;
  } catch (e) {
    alert(`Missing required environment variable: ${key}`);
    return fallback;
  }
}

export const env = {
  apiBaseUrl: () => {
    const raw = (getEnv("VITE_API_BASE_URL", false, "http://localhost:3000/api") || "http://localhost:3000/api").trim().replace(/\/+$/, "");
    return raw.endsWith("/api") ? raw : `${raw}/api`;
  },

  enableMocks: () => getEnv("VITE_ENABLE_MOCKS", false, "false") === "true",

  firebase: {
    apiKey: () => getEnv("VITE_FIREBASE_API_KEY", true, "dummy-firebase-api-key"),
    authDomain: () => getEnv("VITE_FIREBASE_AUTH_DOMAIN", true, "dummy-project.firebaseapp.com"),
    projectId: () => getEnv("VITE_FIREBASE_PROJECT_ID", true, "dummy-project-id"),
    storageBucket: () => getEnv("VITE_FIREBASE_STORAGE_BUCKET", true, "dummy-project.appspot.com"),
    messagingSenderId: () => getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", true, "000000000000"),
    appId: () => getEnv("VITE_FIREBASE_APP_ID", true, "1:000000000000:web:dummy-app-id"),
    measurementId: () => getEnv("VITE_FIREBASE_MEASUREMENT_ID", false, "G-DUMMY00000"),
  },

  // sarvamApiKey — intentionally NOT exposed. Sarvam STT/TTS is now
  // invoked via the backend (PlivoService). See SECRET HANDLING POLICY above.

  vapidPublicKey: () => getEnv("VITE_VAPID_PUBLIC_KEY", true, "dummy-vapid-public-key"),

  plivo: {
    endpointUsername: () => getEnv("VITE_PLIVO_ENDPOINT_USERNAME", false, "dummy_endpoint_username"),
    endpointPassword: () => getEnv("VITE_PLIVO_ENDPOINT_PASSWORD", false, "dummy_endpoint_password"),
    streamUrl: () => getEnv("VITE_PLIVO_STREAM_URL", false, "wss://dummy-stream-url.plivo.com"),
    agent1Username: () => resolveEnv("VITE_PLIVO_AGENT_1_USERNAME", import.meta.env.VITE_PLIVO_AGENT_1_USERNAME) || "",
    agent1Password: () => resolveEnv("VITE_PLIVO_AGENT_1_PASSWORD", import.meta.env.VITE_PLIVO_AGENT_1_PASSWORD) || "",
    agent2Username: () => resolveEnv("VITE_PLIVO_AGENT_2_USERNAME", import.meta.env.VITE_PLIVO_AGENT_2_USERNAME) || "",
    agent2Password: () => resolveEnv("VITE_PLIVO_AGENT_2_PASSWORD", import.meta.env.VITE_PLIVO_AGENT_2_PASSWORD) || "",
    agent3Username: () => resolveEnv("VITE_PLIVO_AGENT_3_USERNAME", import.meta.env.VITE_PLIVO_AGENT_3_USERNAME) || "",
    agent3Password: () => resolveEnv("VITE_PLIVO_AGENT_3_PASSWORD", import.meta.env.VITE_PLIVO_AGENT_3_PASSWORD) || "",
    agent4Username: () => resolveEnv("VITE_PLIVO_AGENT_4_USERNAME", import.meta.env.VITE_PLIVO_AGENT_4_USERNAME) || "",
    agent4Password: () => resolveEnv("VITE_PLIVO_AGENT_4_PASSWORD", import.meta.env.VITE_PLIVO_AGENT_4_PASSWORD) || "",
  },

  // internalApiKey — intentionally NOT exposed. The INTERNAL_API_KEY is a
  // service-to-service token used by backend workers. It must never reach
  // the browser. See SECRET HANDLING POLICY above.

  // FAQ and POP are served by the backend's proxy (/api/faq, /api/pop), so they hang off
  // the API base URL like every other call. They must NOT default to a relative path: the
  // built app is served by Firebase Hosting, whose SPA rewrite answers any unknown path
  // with index.html and a 200 — so a relative /api/pop/... silently returns the HTML page
  // instead of JSON. Only an explicit VITE_FAQ_API_URL / VITE_POP_API_URL overrides this.
  helplineNumber: () => getEnv("VITE_AGRISEVA_HELPLINE_NUMBER", false, "+15551689646"),
  whatsappNumber: () => getEnv("VITE_WHATSAPP_NUMBER", false, getEnv("VITE_AGRISEVA_HELPLINE_NUMBER", false, "+15551689646")),

  faqApiUrl: () => getEnv("VITE_FAQ_API_URL", false, "") || `${apiBase()}/faq`,
  popApiUrl: () => getEnv("VITE_POP_API_URL", false, "") || `${apiBase()}/pop`,
};

/** API base URL without a trailing slash, e.g. "https://…run.app/api". */
function apiBase(): string {
  return env.apiBaseUrl().replace(/\/$/, "");
}
