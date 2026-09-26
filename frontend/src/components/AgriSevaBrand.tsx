import React from "react";
import { useTranslation } from "@/locales";

interface AgriSevaBrandProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "banner";
  showSlogan?: boolean;
  align?: "left" | "center";
  /**
   * When true, the logo SVG becomes a touch smaller at very small widths
   * (below `xs:` / 384px) and the slogan NEVER renders even at sm+. Used by
   * the global header at mobile widths where the right-side icon cluster
   * needs every pixel of vertical and horizontal space.
   */
  compactBelowSm?: boolean;
}

export function AgriSevaBrand({
  className = "",
  size = "md",
  showSlogan = true,
  align = "left",
  compactBelowSm = false,
}: AgriSevaBrandProps) {
  const { t } = useTranslation();
  const isCenter = align === "center";

  // Sizing configurations. At `compactBelowSm`, we shave both the SVG mascot
  // and the brand text by 1–2 Tailwind steps below the `xs:` breakpoint so
  // the global header fits comfortably at 320–375px.
  const robotSizes = {
    sm: compactBelowSm
      ? "w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8"
      : "w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9",
    md: "w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11",
    lg: "w-12 h-12 sm:w-14 sm:h-14",
    banner: "w-14 h-14 md:w-20 md:h-20",
  };

  const titleSizes = {
    sm: compactBelowSm
      ? "text-sm xs:text-base sm:text-lg font-bold tracking-tight whitespace-nowrap"
      : "text-base xs:text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap",
    md: "text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight",
    lg: "text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight",
    banner: "text-2xl sm:text-3xl md:text-5xl font-black tracking-tight",
  };

  const sloganSizes = {
    sm: "text-[11px] font-medium tracking-normal hidden sm:block text-muted-foreground",
    md: "text-xs md:text-sm font-serif italic text-muted-foreground",
    lg: "text-sm md:text-base font-serif italic text-muted-foreground",
    banner: "text-sm md:text-lg font-serif italic text-gray-700 dark:text-gray-300",
  };

  // For compactBelowSm the slogan is suppressed entirely regardless of prop.
  const effectiveShowSlogan = compactBelowSm ? false : showSlogan;

  return (
    <div
      className={`inline-flex items-center gap-2 xxs:gap-2.5 sm:gap-3.5 min-w-0 ${
        isCenter ? "justify-center text-center" : "text-left"
      } ${className}`}
    >
      {/* Cute Robot Mascot with Speech Bubble */}
      <div className={`relative shrink-0 flex items-center justify-center ${robotSizes[size]}`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm transition-transform hover:scale-105 duration-200"
        >
          {/* Speech Bubble on Top Right */}
          <g>
            <rect
              x="52"
              y="6"
              width="42"
              height="30"
              rx="9"
              fill="#F97352"
            />
            {/* Speech pointer */}
            <polygon points="62,36 54,46 72,36" fill="#F97352" />
            {/* Bubble lines / text placeholder */}
            <line x1="61" y1="16" x2="85" y2="16" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="61" y1="24" x2="79" y2="24" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* Robot Antenna */}
          <circle cx="34" cy="20" r="5" fill="#F97352" />
          <line x1="34" y1="25" x2="34" y2="34" stroke="#F97352" strokeWidth="4" strokeLinecap="round" />

          {/* Robot Ears / Side Nodes */}
          <rect x="8" y="50" width="10" height="18" rx="5" fill="#F97352" />
          <rect x="50" y="50" width="10" height="18" rx="5" fill="#F97352" />

          {/* Robot Face Box */}
          <rect
            x="13"
            y="34"
            width="42"
            height="44"
            rx="16"
            fill="#F97352"
          />

          {/* Inner Face Screen */}
          <rect
            x="18"
            y="39"
            width="32"
            height="34"
            rx="12"
            fill="#FFF1EE"
          />

          {/* Eyes (Cute Happy Curved / Oval Eyes) */}
          <circle cx="26" cy="52" r="3" fill="#F97352" />
          <circle cx="42" cy="52" r="3" fill="#F97352" />

          {/* Smile */}
          <path
            d="M 29 60 Q 34 66 39 60"
            stroke="#F97352"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Brand Typography & Slogan */}
      <div className="flex flex-col justify-center select-none">
        <h1
          className={`leading-none ${titleSizes[size]}`}
          style={{
            fontFamily: "'Playfair Display', 'Merriweather', 'Georgia', serif",
          }}
        >
          <span className="text-[#15803D] dark:text-[#22C55E]">AgriSeva</span>
          <span className="text-[#F97352] mx-0.5">-</span>
          <span className="text-[#15803D] dark:text-[#22C55E]">AI</span>
        </h1>

        {effectiveShowSlogan && (
          <p
            className={`mt-1 tracking-tight ${sloganSizes[size]}`}
            style={{
              fontFamily: "'Georgia', 'Cambria', serif",
            }}
          >
            {t("common.slogan", "Every Farmer a King, with AI by their side.")}
          </p>
        )}
      </div>
    </div>
  );
}

export default AgriSevaBrand;
