import React, { useState, useMemo } from "react";
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

  const content = (
    <div className="w-full max-w-2xl bg-[#0d1512]/95 border border-emerald-500/20 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col max-h-[90vh] text-white">
      {/* Header */}
      <div className="flex items-start justify-between pb-5 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center p-2 shadow-inner">
            <img
              src="/favicon.svg"
              alt="AgriSeva-AI Mascot"
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to globe icon if svg fails to load
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Choose your language
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                23 Languages
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Select the language you are most comfortable with.
            </p>
          </div>
        </div>

        {isModal && (
          <button
            onClick={closeLanguageSelector}
            className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mt-4 relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search language / भाषा खोजें / భాషను శోధించండి..."
          className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
          >
            Clear
          </button>
        )}
      </div>

      {/* Language Grid */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 custom-scrollbar min-h-[260px] max-h-[380px]">
        {filteredLanguages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-neutral-400">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No language matches "{searchQuery}"</p>
          </div>
        ) : (
          filteredLanguages.map((lang) => {
            const isSelected = selectedLang?.code === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all group ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "bg-white/[0.02] border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.05] text-neutral-300"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div
                    className={`font-semibold text-sm truncate ${
                      isSelected ? "text-emerald-400" : "text-white group-hover:text-emerald-300"
                    }`}
                  >
                    {lang.nativeName}
                  </div>
                  <div className="text-xs text-neutral-400 truncate mt-0.5">
                    {lang.name}
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "bg-emerald-500 text-black"
                      : "border border-white/10 group-hover:border-emerald-500/40"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Validation alert */}
      {showError && (
        <div className="mt-3 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>Please select a language to continue.</span>
        </div>
      )}

      {/* Footer / Continue CTA */}
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-400">
          {selectedLang ? (
            <span>
              Selected: <strong className="text-white">{selectedLang.nativeName}</strong> ({selectedLang.name})
            </span>
          ) : (
            <span>No language selected yet</span>
          )}
        </div>

        <button
          onClick={handleContinue}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all active:scale-98"
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070c0a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-[#070c0a] to-[#040605] flex items-center justify-center p-4">
      {content}
    </div>
  );
};
