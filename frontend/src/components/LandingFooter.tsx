import { Link } from "@tanstack/react-router";
import { ShieldCheck, Github, Mail, Globe } from "lucide-react";

/**
 * Minimal footer rendered inside LandingPage. Kept separate from the legal
 * pages' own footer so we can tune styling without affecting the legal
 * template.
 */
export function LandingFooter() {
  return (
    <footer
      role="contentinfo"
      className="w-full border-t border-stone-200/70 bg-white/70 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-3 text-sm text-stone-700">
        <div>
          <p className="font-semibold text-stone-900">AgriSeva-AI</p>
          <p className="mt-1 text-xs leading-relaxed">
            AI-powered farming intelligence with live Agmarknet market data,
            weather, soil health, government schemes, and multilingual voice
            advisory for Indian farmers.
          </p>
        </div>
        <nav aria-label="Legal" className="grid gap-1">
          <p className="font-semibold text-stone-900">Legal</p>
          <Link to="/privacy" className="hover:text-emerald-700">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-emerald-700">
            Terms &amp; Conditions
          </Link>
          <a
            href="mailto:hello@agriseva.ai"
            className="hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <Mail size={12} aria-hidden="true" /> Contact
          </a>
        </nav>
        <nav aria-label="Resources" className="grid gap-1">
          <p className="font-semibold text-stone-900">Resources</p>
          <a
            href="https://agmarknet.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <Globe size={12} aria-hidden="true" /> Agmarknet
          </a>
          <a
            href="https://enam.gov.in/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <Globe size={12} aria-hidden="true" /> eNAM
          </a>
          <a
            href="https://www.myscheme.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <Globe size={12} aria-hidden="true" /> myscheme.gov.in
          </a>
        </nav>
      </div>
      <div className="border-t border-stone-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-stone-600">
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} aria-hidden="true" /> © {new Date().getFullYear()}{" "}
            AgriSeva-AI. Built for Indian farmers.
          </p>
          <p className="inline-flex items-center gap-3">
            <a
              href="https://github.com/Nikhilsai-9/AgriSeva-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 inline-flex items-center gap-1"
            >
              <Github size={12} aria-hidden="true" /> Source
            </a>
            <span aria-hidden="true">•</span>
            <span>Market data: Agmarknet / eNAM</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;