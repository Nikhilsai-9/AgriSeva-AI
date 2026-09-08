import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/config/languages";

interface LanguageState {
  currentLanguage: Language | null;
  hasSelectedLanguage: boolean;
  hasHydrated: boolean;
  isSelectorOpen: boolean;
  setLanguage: (lang: Language) => void;
  setHasSelectedLanguage: (hasSelected: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  openLanguageSelector: () => void;
  closeLanguageSelector: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      currentLanguage: null,
      hasSelectedLanguage: false,
      hasHydrated: false,
      isSelectorOpen: false,

      setLanguage: (lang: Language) => {
        if (typeof document !== "undefined") {
          const langCode = lang.code.split("-")[0];
          document.documentElement.lang = langCode;
          document.documentElement.dir = lang.dir || "ltr";
        }
        set({
          currentLanguage: lang,
          hasSelectedLanguage: true,
          isSelectorOpen: false,
        });
      },

      setHasSelectedLanguage: (hasSelectedLanguage: boolean) =>
        set({ hasSelectedLanguage }),

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),

      openLanguageSelector: () => set({ isSelectorOpen: true }),
      closeLanguageSelector: () => set({ isSelectorOpen: false }),
    }),
    {
      name: "agriseva-language-preference",
      partialize: (state) => ({
        currentLanguage: state.currentLanguage,
        hasSelectedLanguage: state.hasSelectedLanguage,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          if (state.currentLanguage && typeof document !== "undefined") {
            const langCode = state.currentLanguage.code.split("-")[0];
            document.documentElement.lang = langCode;
            document.documentElement.dir = state.currentLanguage.dir || "ltr";
          }
        }
      },
    }
  )
);
