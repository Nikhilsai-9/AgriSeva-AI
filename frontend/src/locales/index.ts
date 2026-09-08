import { useCallback } from "react";
import { useLanguageStore } from "@/stores/language-store";
import { en, type TranslationDictionary } from "./en";
import { hi } from "./hi";
import { te } from "./te";
import { ta } from "./ta";
import { kn } from "./kn";
import { ml } from "./ml";
import { mr } from "./mr";
import { bn } from "./bn";
import { gu } from "./gu";
import { pa } from "./pa";
import { od } from "./od";
import { as } from "./as";
import { ur } from "./ur";
import { mai } from "./mai";
import { brx } from "./brx";
import { doi } from "./doi";
import { ks } from "./ks";
import { kok } from "./kok";
import { mni } from "./mni";
import { ne } from "./ne";
import { sa } from "./sa";
import { sat } from "./sat";
import { sd } from "./sd";

export type { TranslationDictionary };
export { en };

const dictionaries: Record<string, Partial<TranslationDictionary>> = {
  "en-IN": en,
  en: en,
  "hi-IN": hi,
  hi: hi,
  "te-IN": te,
  te: te,
  "ta-IN": ta,
  ta: ta,
  "kn-IN": kn,
  kn: kn,
  "ml-IN": ml,
  ml: ml,
  "mr-IN": mr,
  mr: mr,
  "bn-IN": bn,
  bn: bn,
  "gu-IN": gu,
  gu: gu,
  "pa-IN": pa,
  pa: pa,
  "od-IN": od,
  od: od,
  "as-IN": as,
  as: as,
  "ur-IN": ur,
  ur: ur,
  "mai-IN": mai,
  mai: mai,
  "brx-IN": brx,
  brx: brx,
  "doi-IN": doi,
  doi: doi,
  "ks-IN": ks,
  ks: ks,
  "kok-IN": kok,
  kok: kok,
  "mni-IN": mni,
  mni: mni,
  "ne-IN": ne,
  ne: ne,
  "sa-IN": sa,
  sa: sa,
  "sat-IN": sat,
  sat: sat,
  "sd-IN": sd,
  sd: sd,
};

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Safely resolves a translation string by key path:
 * Target Dictionary -> English Dictionary -> Explicit Fallback -> Non-key string fallback.
 * NEVER returns raw translation keys like "hero.headline.l1" to the user.
 */
export function resolveTranslation(
  langCode: string | null | undefined,
  keyPath: string,
  fallback?: string,
  params?: Record<string, string | number>
): string {
  let result = "";
  if (langCode) {
    const dict = dictionaries[langCode] || dictionaries[langCode.split("-")[0]];
    if (dict) {
      const val = getNestedValue(dict, keyPath);
      if (val) result = val;
    }
  }

  if (!result) {
    // Fallback to English dictionary
    const enVal = getNestedValue(en, keyPath);
    if (enVal) result = enVal;
    else if (fallback !== undefined) result = fallback;
  }

  if (!result) return "";

  if (params && typeof params === "object") {
    for (const [paramKey, paramVal] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
    }
  }

  return result;
}

export function useTranslation() {
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);

  const t = useCallback(
    (keyPath: string, fallback?: string, params?: Record<string, string | number>): string => {
      return resolveTranslation(currentLanguage?.code, keyPath, fallback, params);
    },
    [currentLanguage]
  );

  return { t, currentLanguage };
}
