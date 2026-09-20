// Section 2: Stakeholders & User Roles.
module.exports = [
  function s2(H) {
    H.H1("2. Stakeholders & User Roles");
    H.P(
      "AgriSeva-AI recognises eleven role strings on the wire (see frontend/src/lib/roles.ts). " +
      "Each maps to a distinct mix of navigation, API permissions, and AI tool surface. The " +
      "platform uses Firebase Auth as the identity provider and a JWT trust chain to the backend."
    );
    H.TABLE(
      ["Role", "Code", "Primary Job-to-be-Done", "Surface"],
      [
        ["Admin",                  "admin",                 "Operate the platform, manage roles, full audit access", "Admin console + every route"],
        ["Moderator",              "moderator",             "Triage incoming questions, allocate reviewers", "Moderator console"],
        ["Expert / PAE-Expert",    "expert / pae_expert",   "Write and review answer content for the Golden Dataset", "Reviewer console + /pae-expert"],
        ["Gate Keeper / Auditor",  "gate_keeper / auditor", "First-pass and second-pass quality gating", "Quality console + /audit"],
        ["Reviewer",               "reviewer",              "Approve or rewrite AI-generated answers", "Reviewer console"],
        ["Tester",                 "tester",                "Run controlled flows during pre-release", "Same as moderator surface"],
        ["Call Agent",             "call_agent",            "Operate the inbound voice / WhatsApp queue", "Chatbot console"],
        ["District Coordinator",   "district_coordinator",  "Field operations for a district", "/coordinator"],
        ["Block Coordinator",      "block_coordinator",     "Field operations for a block",        "/coordinator"],
        ["Village Volunteer",      "village_volunteer",     "Field operations for a village",       "/coordinator"],
        ["Farmer",                 "farmer",                "Ask questions, manage lots and offers, view prices", "/farmer dashboard"],
      ],
      { widths: [120, 110, 250, 100] }
    );
    H.H3("Role helpers (frontend/src/lib/roles.ts)");
    H.UL([
      "COORDINATOR_ROLES  — district_coordinator, block_coordinator, village_volunteer.",
      "USER_MANAGEMENT_ROLES — admin, moderator, tester, gate_keeper, auditor.",
      "QUEUE_DETAILS_ROLES — admin, moderator, gate_keeper, auditor.",
      "isCoordinatorRole(role) and canManageUsers(role) are the two predicates used by the global nav.",
    ]);
    H.H3("What each role sees on sign-in");
    H.TABLE(
      ["Role", "Brand-Link Home", "Visible Global Nav", "Sub-Console"],
      [
        ["admin",                 "/home",       "Dashboard · WhatsApp History · ChatBot Analytics · Notifications · Audit · Flags Reported · Submission History · Users · Expert Management", "Admin tools + reviewer console"],
        ["moderator",             "/home",       "Dashboard · WhatsApp History · ChatBot Analytics · Notifications · Audit · Flags Reported · Submission History", "Moderator queue"],
        ["expert",                "/home",       "Dashboard · WhatsApp History · Notifications · Submission History", "Reviewer console"],
        ["pae_expert",            "/pae-expert", "WhatsApp History · Notifications", "PAE-Expert drafting surface"],
        ["gate_keeper / auditor", "/home",       "Dashboard · WhatsApp History · Notifications · Audit · Flags Reported", "Audit console"],
        ["reviewer",              "/home",       "Dashboard · WhatsApp History · Notifications", "Reviewer console"],
        ["call_agent",            "/home",       "Dashboard · Notifications", "Call console"],
        ["district/block/village","/coordinator","Coordinator-only (nav suppressed)", "Field ops console"],
        ["farmer",                "/farmer",     "Farmer Dashboard · Notifications", "Farmer dashboard (13 routes)"],
      ],
      { widths: [110, 64, 280, 140] }
    );
  },
];
