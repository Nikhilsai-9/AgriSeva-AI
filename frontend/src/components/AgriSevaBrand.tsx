import React from "react";

interface AgriSevaBrandProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "banner";
  showSlogan?: boolean;
  align?: "left" | "center";
}

export function AgriSevaBrand({
  className = "",
  size = "md",
  showSlogan = true,
  align = "left",
}: AgriSevaBrandProps) {
  const isCenter = align === "center";

  // Sizing configurations
  const robotSizes = {
    sm: "w-8 h-8",
    md: "w-11 h-11",
    lg: "w-14 h-14",
    banner: "w-16 h-16 md:w-20 md:h-20",
  };

  const titleSizes = {
    sm: "text-lg md:text-xl font-bold tracking-tight",
    md: "text-2xl md:text-3xl font-extrabold tracking-tight",
    lg: "text-3xl md:text-4xl font-extrabold tracking-tight",
    banner: "text-3xl md:text-5xl font-black tracking-tight",
  };

  const sloganSizes = {
    sm: "text-[11px] font-medium tracking-normal",
    md: "text-xs md:text-sm font-serif italic text-muted-foreground",
    lg: "text-sm md:text-base font-serif italic text-muted-foreground",
    banner: "text-sm md:text-lg font-serif italic text-gray-700 dark:text-gray-300",
  };

  return (
    <div
      className={`inline-flex items-center gap-3.5 ${
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

        {showSlogan && (
          <p
            className={`mt-1 tracking-tight ${sloganSizes[size]}`}
            style={{
              fontFamily: "'Georgia', 'Cambria', serif",
            }}
          >
            Every Farmer a King, with AI by their side.
          </p>
        )}
      </div>
    </div>
  );
}

export default AgriSevaBrand;
