import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Check, Globe, X, ArrowRight } from "lucide-react";
import { LANGUAGES, type Language } from "@/config/languages";
import { useLanguageStore } from "@/stores/language-store";

interface LanguageGatewayProps {
  isModal?: boolean;
  onComplete?: () => void;
}

export const LanguageGateway: React.FC<LanguageGatewayProps> = ({
  isModal = false,
  onComplete,
}) => {
  const { currentLanguage, setLanguage, closeLanguageSelector } = useLanguageStore();
  const [selectedLang, setSelectedLang] = useState<Language | null>(currentLanguage);
  const [searchQuery, setSearchQuery] = useState("");
  const [showError, setShowError] = useState(false);

  // Sync selectedLang if currentLanguage changes externally
  useEffect(() => {
    setSelectedLang(currentLanguage);
  }, [currentLanguage]);

  // Handle ESC key to close modal and prevent background scroll
  useEffect(() => {
    if (!isModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLanguageSelector();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModal, closeLanguageSelector]);

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.script.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelect = (lang: Language) => {
    setSelectedLang(lang);
    setShowError(false);
  };

  const handleContinue = () => {
    if (!selectedLang) {
      setShowError(true);
      return;
    }
    setLanguage(selectedLang);
    if (onComplete) {
      onComplete();
    } else if (isModal) {
      closeLanguageSelector();
    }
  };

  const dialogContent = (
    <div
      className="w-full max-w-2xl bg-[#0d1512]/95 border border-emerald-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-4 sm:p-6 md:p-8 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[88vh] text-white my-auto overflow-hidden transition-all"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal={isModal}
      aria-labelledby="language-gateway-title"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-3 sm:pb-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center p-2 shadow-inner shrink-0">
            <img
              src="/favicon.svg"
              alt="AgriSeva-AI Mascot"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="language-gateway-title" className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                Choose your language
              </h2>
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                23 Languages
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 sm:mt-1">
              Select the language you are most comfortable with.
            </p>
          </div>
        </div>

        {isModal && (
          <button
            type="button"
            onClick={closeLanguageSelector}
            className="text-neutral-400 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
            title="Close"
            aria-label="Close language selector"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mt-3 sm:mt-4 relative shrink-0">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search language / भाषा खोजें / భాషను శోధించండి..."
          className="w-full pl-10 pr-12 py-2 sm:py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Language Grid */}
      <div className="mt-3 sm:mt-4 flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 custom-scrollbar">
        {filteredLanguages.length === 0 ? (
          <div className="col-span-full py-8 sm:py-12 text-center text-neutral-400">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No language matches "{searchQuery}"</p>
          </div>
        ) : (
          filteredLanguages.map((lang) => {
            const isSelected = selectedLang?.code === lang.code;
            return (
              <button
                type="button"
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-left transition-all group cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "bg-white/[0.02] border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.05] text-neutral-300"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div
                    className={`font-semibold text-xs sm:text-sm truncate ${
                      isSelected ? "text-emerald-400" : "text-white group-hover:text-emerald-300"
                    }`}
                  >
                    {lang.nativeName}
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5">
                    {lang.name}
                  </div>
                </div>
                <div
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "bg-emerald-500 text-black"
                      : "border border-white/10 group-hover:border-emerald-500/40"
                  }`}
                >
                  {isSelected && <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Validation alert */}
      {showError && (
        <div className="mt-2.5 py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <span>⚠️</span>
          <span>Please select a language to continue.</span>
        </div>
      )}

      {/* Footer / Continue CTA */}
      <div className="mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-neutral-400 truncate min-w-0">
          {selectedLang ? (
            <span className="truncate block">
              Selected: <strong className="text-white">{selectedLang.nativeName}</strong> <span className="hidden sm:inline">({selectedLang.name})</span>
            </span>
          ) : (
            <span>No language selected yet</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-xs sm:text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all active:scale-98 shrink-0 cursor-pointer"
        >
          <span>Continue</span>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );

  if (isModal) {
    if (typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn"
        onClick={closeLanguageSelector}
      >
        {dialogContent}
      </div>,
      document.body
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070c0a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-[#070c0a] to-[#040605] flex items-center justify-center p-4">
      {dialogContent}
    </div>
  );
};
