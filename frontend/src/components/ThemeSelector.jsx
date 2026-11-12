import { Moon, Sun } from "lucide-react";
import { classNames } from "../utils/classNames";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSelector({ value, onChange, inverted = false, compact = false }) {
  return (
    <div
      className={classNames(
        "inline-flex items-center rounded-xl border p-1 shadow-sm backdrop-blur",
        inverted && "theme-selector-inverted",
        inverted ? "border-white/15 bg-white/10" : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80"
      )}
      role="group"
      aria-label="Color theme"
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={classNames(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
              compact ? "w-8 px-0" : "min-w-8",
              active
                ? inverted
                  ? "bg-white text-slate-950 shadow-sm"
                  : "bg-emerald-700 text-white shadow-sm"
                : inverted
                  ? "text-slate-300 hover:bg-white/10 hover:text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            )}
            title={`${label} theme`}
            aria-pressed={active}
          >
            <Icon size={14} />
            {!compact && <span className="hidden xl:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
