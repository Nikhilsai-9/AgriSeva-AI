// Sections 25 + 26: Glossary + Sign-off.
module.exports = [
  // 25 Glossary
  function s25(H) {
    H.H1("25. Glossary");
    H.TABLE(
      ["Term", "Meaning"],
      [
        ["ACC agent",      "Acceptance / correctness / compliance agent — human-in-the-loop reviewer"],
        ["Agmarknet",      "Government of India's agricultural commodity prices portal (primary mandi source)"],
        ["aegra",          "The LangGraph dev/runtime harness used to start the FastAPI agent"],
        ["eNAM",           "Electronic National Agriculture Market — secondary mandi source"],
        ["FPO",            "Farmer Producer Organisation — a collective that acts as a buyer"],
        ["GDB",            "Golden Dataset — expert-verified question/answer pairs"],
        ["Golden Embedding","BAAI/bge-large-en-v1.5 embedding model used for vector retrieval"],
        ["KVK",            "Krishi Vigyan Kendra — agricultural extension centres that publish PoP"],
        ["LGD",            "Local Government Directory — states / districts / blocks / villages reference"],
        ["MCP",            "Model Context Protocol — standardised tool-calling surface over HTTP"],
        ["PAE",            "Project Agricultural Expert — content authorship role"],
        ["PoP",            "Package of Practices — crop- and state-specific agricultural guidelines"],
        ["RAG",            "Retrieval-Augmented Generation — answers grounded in retrieved context"],
        ["Reviewer",       "Human who validates or rewrites an AI-generated answer"],
        ["Sarvam",         "Sarvam AI — Indian-language translation + speech service"],
        ["Subagent",       "A dedicated LLM ReAct loop responsible for a single domain"],
        ["Supervisor",     "The main agent that picks subagents and orchestrates the answer"],
      ],
      { widths: [110, 340] }
    );
  },

  // 26 Sign-off
  function s26(H) {
    H.H1("26. Sign-Off & Maintenance");
    H.P(
      "This PDF is generated programmatically from the source tree and the project's existing " +
      "documentation. To regenerate after changes:"
    );
    H.CODE(
      "cd C:\\Users\\saini\\OneDrive\\Desktop\\CSP\\AgriSeva-Ai\n" +
      "node docs/build-project-pdf.js\n" +
      "# -> docs/project-bible.pdf"
    );
    H.P(
      "Recommended cadence: regenerate after any milestone (auth hardening, MCP addition, Cloud Run " +
      "job migration, locale batch) and re-distribute to reviewers. The build script is " +
      "intentionally self-contained and idempotent — no external network calls."
    );
    H.P(
      "For questions about a specific section, open the linked markdown file in the repo or refer to the " +
      "evidence column in DONE / PENDING tables above."
    );
    H.BR();
    H.BR();
  },
];
