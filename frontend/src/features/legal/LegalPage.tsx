import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Sprout,
  Mail,
  Globe,
  ShieldCheck,
  Database,
  Lock,
} from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { AgriSevaBrand } from "@/components/AgriSevaBrand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "@/locales";

/**
 * Shared shell + sidebar used by Privacy and Terms pages so the two
 * pages stay visually and structurally identical.
 */

export interface LegalSection {
  icon?: React.ReactNode;
  heading: string;
  paragraphs: React.ReactNode[];
}

export interface LegalPageProps {
  pageTitle: string;
  description: string;
  effectiveDate: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  contactEmail: string;
  contactJurisdiction: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ScrollSpy({ sections }: { sections: LegalSection[] }) {
  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-6 hidden lg:block w-64 shrink-0 self-start"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-900/60 mb-3">
        On this page
      </p>
      <ul className="space-y-2 text-sm">
        {sections.map((s) => (
          <li key={s.heading}>
            <a
              href={`#${slugify(s.heading)}`}
              className="text-emerald-900/80 hover:text-emerald-700 hover:underline underline-offset-2"
            >
              {s.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LegalPage(props: LegalPageProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/60 via-white to-amber-50/40 text-emerald-950 font-sans">
      <PageMeta title={props.pageTitle} description={props.description} />

      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="AgriSeva-AI home" className="block">
            <AgriSevaBrand size="sm" showSlogan={false} />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="outline" />
            <Link
              to="/"
              className="text-sm font-semibold text-emerald-800 hover:text-emerald-600 inline-flex items-center gap-1"
            >
              <Globe size={14} /> {t("common.backToHome", "Back to site")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex gap-10">
        <ScrollSpy sections={props.sections} />
        <article className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2 inline-flex items-center gap-1.5">
            <Sprout size={14} /> {props.pageTitle}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-emerald-950">
            {props.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-emerald-900/70">
            Effective date: {props.effectiveDate}
          </p>

          <div className="mt-8 space-y-3 text-[15px] leading-relaxed text-emerald-900/85">
            {props.intro}
          </div>

          {props.sections.map((s) => (
            <section
              key={s.heading}
              id={slugify(s.heading)}
              className="mt-10 scroll-mt-24"
            >
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-950 inline-flex items-center gap-2">
                {s.icon}
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-emerald-900/85">
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-emerald-950 inline-flex items-center gap-2">
              <Mail size={18} /> Contact us
            </h2>
            <p className="mt-2 text-sm text-emerald-900/85">
              For questions about this {props.pageTitle.toLowerCase()}, email{" "}
              <a
                href={`mailto:${props.contactEmail}`}
                className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
              >
                {props.contactEmail}
              </a>
              . {props.contactJurisdiction}
            </p>
          </section>

          <p className="mt-10 text-xs text-emerald-900/50 inline-flex items-center gap-1.5">
            <ShieldCheck size={12} /> AgriSeva-AI is committed to protecting
            farmer data. We collect only what we need to deliver the service.
          </p>
        </article>
      </main>

      <footer className="border-t border-emerald-100 bg-white/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-emerald-900/70">
          <p className="inline-flex items-center gap-1.5">
            <Database size={12} /> © {new Date().getFullYear()} AgriSeva-AI.
            All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-emerald-700">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-emerald-700">
              Terms
            </Link>
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Encrypted in transit
            </span>
          </nav>
        </div>
      </footer>
    </div>
  );
}