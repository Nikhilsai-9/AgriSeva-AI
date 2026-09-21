import { useEffect } from "react";

export const CANONICAL_SITE_TITLE = "AgriSeva-AI | AI Advisory for Indian Farmers";

/**
 * Lightweight per-route metadata setter.
 *
 * Why not react-helmet: it's another dep, ~12 KB, and we only need
 * document.title + a description meta tag. We mutate the DOM and
 * restore on unmount so back/forward navigation in the SPA shows the
 * right title.
 *
 * Usage:
 *   <PageMeta title="Privacy Policy" description="..." />
 */
export interface PageMetaProps {
  title?: string;
  /** When provided, overrides the index.html description for this page. */
  description?: string;
  /** When true, search engines should not index this route (e.g. /auth). */
  noindex?: boolean;
}

const META_DESC = "description";
const META_ROBOTS = "robots";
const OG_TITLE = "og:title";
const OG_DESC = "og:description";
const TWITTER_TITLE = "twitter:title";
const TWITTER_DESC = "twitter:description";

function cleanTitleString(str: string): string {
  if (!str) return "";
  return str
    .replace(/ΓÇö|—/g, "|")
    .replace(/ΓåÆ|→/g, "")
    .replace(/\s*\|\s*/g, " | ")
    .trim();
}

export function formatPageTitle(title?: string): string {
  if (!title) return CANONICAL_SITE_TITLE;
  const cleaned = cleanTitleString(title);
  if (
    !cleaned ||
    cleaned === "AgriSeva-AI" ||
    cleaned === CANONICAL_SITE_TITLE ||
    cleaned.toLowerCase().includes("ai advisory for indian farmers")
  ) {
    return CANONICAL_SITE_TITLE;
  }
  return cleaned.includes("AgriSeva-AI") ? cleaned : `${cleaned} | AgriSeva-AI`;
}

function setMeta(nameOrProp: string, value: string, isProperty = false) {
  if (typeof document === "undefined") return;
  const selector = isProperty
    ? `meta[property="${nameOrProp}"]`
    : `meta[name="${nameOrProp}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    if (isProperty) el.setAttribute("property", nameOrProp);
    else el.setAttribute("name", nameOrProp);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function PageMeta({ title, description, noindex }: PageMetaProps) {
  useEffect(() => {
    const fullTitle = formatPageTitle(title);
    document.title = fullTitle;

    // Per-route OG/Twitter title overrides so social shares carry the
    // specific page title rather than the site-wide default.
    setMeta(OG_TITLE, fullTitle, true);
    setMeta(TWITTER_TITLE, fullTitle);

    if (description) {
      setMeta(META_DESC, description);
      setMeta(OG_DESC, description, true);
      setMeta(TWITTER_DESC, description);
    }

    if (noindex) {
      setMeta(META_ROBOTS, "noindex,nofollow");
    } else {
      setMeta(META_ROBOTS, "index,follow");
    }

    return () => {
      // On unmount, restore to the static canonical title.
      document.title = CANONICAL_SITE_TITLE;
      setMeta(META_ROBOTS, "index,follow");
    };
  }, [title, description, noindex]);

  return null;
}

export default PageMeta;