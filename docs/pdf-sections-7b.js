// Section 13: Communication channels.
module.exports = [
  function s13(H) {
    H.H1("13. Communication Channels");
    H.H2("13.1  Plivo — browser & PSTN voice");
    H.UL([
      "Plivo Web SDK in the browser for outbound SIP calling from the dashboard.",
      "Plivo PSTN numbers for inbound voice to the AI agent — recorded, sent through STT and answered by the LangGraph agent.",
      "Plivo credentials in frontend VITE_PLIVO_*; backend plivo/ module handles DTMF + hangup.",
      "Streaming audio is supported through a custom ws / WebSocket bridge.",
    ]);
    H.H2("13.2  WhatsApp");
    H.UL([
      "WhatsApp Cloud API integration in backend/src/modules/whatsapp/.",
      "Per-conversation logs persisted in whatsappThreads.",
      "Same LangGraph agent as the chat UI — only the transport differs.",
      "Outbound notifications flow through the same channel.",
    ]);
    H.H2("13.3  Push notifications");
    H.UL([
      "Web push using VAPID public key in VITE_VAPID_PUBLIC_KEY + browser-side PushManager subscription.",
      "Backend notification/ module fans out from any domain event into both the bell icon and push.",
      "Bell icon shows the authenticated user's persisted notifications via GET /api/notifications.",
    ]);
  },
];
