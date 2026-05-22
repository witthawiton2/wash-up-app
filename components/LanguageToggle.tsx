"use client";

import { useLang, setLang, type Lang } from "@/lib/i18n";

interface LanguageToggleProps {
  className?: string;
  variant?: "light" | "dark";
}

export default function LanguageToggle({ className = "", variant = "light" }: LanguageToggleProps) {
  const lang = useLang();

  const langs: Lang[] = ["th", "en"];

  const baseBtn =
    "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors";
  const activeStyle =
    variant === "dark"
      ? "bg-white text-blue-700"
      : "bg-blue-500 text-white";
  const inactiveStyle =
    variant === "dark"
      ? "text-white/70 hover:text-white"
      : "text-slate-500 hover:text-slate-700";
  const wrapStyle =
    variant === "dark"
      ? "bg-white/10 border border-white/20"
      : "bg-slate-100 border border-slate-200";

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${wrapStyle} ${className}`}>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`${baseBtn} ${lang === l ? activeStyle : inactiveStyle}`}
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
