import { useEffect } from "react";

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
  title: string;
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
    const prevTitle = document.title;
    const fullTitle = title.includes("AgriSeva") ? title : `${title} | AgriSeva-AI`;
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
      // On unmount, restore to the static index.html title. Done via
      // the documented SPA fallback used by react-helmet.
      document.title = prevTitle;
      setMeta(META_ROBOTS, "index,follow");
    };
  }, [title, description, noindex]);

  return null;
}

export default PageMeta;