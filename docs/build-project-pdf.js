/**
 * AgriSeva-AI — Project Bible PDF generator
 *
 * Produces a comprehensive PDF documenting every aspect of the platform:
 * architecture, stack, routes, roles, features, AI agent, MCP servers,
 * deployment, what is done vs. pending, and the current state of every layer.
 *
 * Run:   node docs/build-project-pdf.js
 * Out:   docs/project-bible.pdf
 */
const path = require("path");
const fs   = require("fs");

const PDFDocument = require(path.join(
  __dirname, "..", "backend", "node_modules", "pdfkit",
));

const OUT_PATH = path.join(__dirname, "project-bible.pdf");

// Load helpers + sections from sibling modules.
const base = require("./pdf-helpers.js");
const { createHelpers } = base;
const sections = require("./pdf-sections.js");

const H = createHelpers(PDFDocument, OUT_PATH, base);

(async () => {
  sections.forEach((fn) => {
    try { fn(H); }
    catch (e) { console.error("Section failed:", e.message); throw e; }
  });
  H.finish();
  console.log("OK  ->  wrote " + OUT_PATH);
})();
