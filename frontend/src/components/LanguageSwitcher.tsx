import React from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useLanguageStore } from "@/stores/language-store";
import { LanguageGateway } from "./LanguageGateway";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "outline" | "ghost" | "glass" | "light";
  showModalOnlyWhenOpen?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = "",
  variant = "glass",
  showModalOnlyWhenOpen = true,
}) => {
  const { currentLanguage, isSelectorOpen, openLanguageSelector } = useLanguageStore();

  const isLight = variant === "light";

  const variantStyles = {
    glass:
      "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 text-neutral-200",
    outline:
      "bg-transparent border border-emerald-500/30 hover:border-emerald-500/60 text-neutral-200 hover:text-white",
    ghost: "bg-transparent hover:bg-white/5 text-neutral-300 hover:text-white",
    light:
      "bg-white/80 hover:bg-white/95 border border-[#16241c]/15 hover:border-emerald-600/40 text-[#16241c] shadow-xs",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={openLanguageSelector}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer backdrop-blur-sm ${variantStyles} ${className}`}
        title="Change language"
      >
        <Globe
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isLight ? "text-emerald-700" : "text-emerald-400"
          }`}
        />
        <span
          className={`tracking-wide ${
            isLight ? "font-semibold text-[#16241c]" : "font-semibold text-white"
          }`}
        >
          {currentLanguage?.nativeName || "Language"}
        </span>
        <ChevronDown
          className={`w-3 h-3 flex-shrink-0 ${
            isLight ? "text-[#33493c] opacity-80" : "text-neutral-400 opacity-70"
          }`}
        />
      </button>

      {showModalOnlyWhenOpen && isSelectorOpen && <LanguageGateway isModal />}
    </>
  );
};
