"use client";

import { MouseEvent, useSyncExternalStore } from "react";
import { MoonStars, Sparkle, Sun } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

type SaunaTheme = "day" | "night";

const storageKey = "sauna-theme";

function resolveTheme(): SaunaTheme {
  if (typeof window === "undefined") {
    return "day";
  }
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "day" || stored === "night") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function applyTheme(theme: SaunaTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "night" ? "dark" : "light";
  window.localStorage.setItem(storageKey, theme);
  window.dispatchEvent(new CustomEvent("sauna-theme-change"));
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("storage", callback);
  window.addEventListener("sauna-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sauna-theme-change", callback);
  };
}

function getServerThemeSnapshot(): SaunaTheme {
  return "day";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  const theme = useSyncExternalStore(subscribeTheme, resolveTheme, getServerThemeSnapshot);
  const night = theme === "night";

  function switchTheme(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme: SaunaTheme = night ? "day" : "night";
    const rect = event.currentTarget.getBoundingClientRect();
    document.documentElement.style.setProperty("--sauna-theme-x", `${rect.left + rect.width / 2}px`);
    document.documentElement.style.setProperty("--sauna-theme-y", `${rect.top + rect.height / 2}px`);

    const startViewTransition = (
      document as Document & {
        startViewTransition?: (callback: () => void) => { finished: Promise<void> };
      }
    ).startViewTransition;

    const commit = () => {
      applyTheme(nextTheme);
    };

    if (startViewTransition && !reduce) {
      startViewTransition.call(document, commit);
      return;
    }
    commit();
  }

  return (
    <button
      type="button"
      onClick={switchTheme}
      className={[
        "group relative inline-flex h-12 shrink-0 items-center overflow-hidden rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-1 shadow-[var(--sauna-shadow)] transition duration-300 hover:-translate-y-0.5 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sauna-accent)]",
        compact ? "w-[92px]" : "w-[138px]",
      ].join(" ")}
      aria-label={night ? "切换到白天模式" : "切换到深夜模式"}
      aria-pressed={night}
    >
      <motion.span
        className="absolute inset-0 opacity-80"
        animate={
          reduce
            ? undefined
            : {
                background: night
                  ? [
                      "radial-gradient(circle at 78% 35%, rgba(99,230,215,0.30), transparent 34%)",
                      "radial-gradient(circle at 30% 65%, rgba(97,172,255,0.22), transparent 38%)",
                      "radial-gradient(circle at 78% 35%, rgba(99,230,215,0.30), transparent 34%)",
                    ]
                  : [
                      "radial-gradient(circle at 24% 35%, rgba(21,184,166,0.18), transparent 34%)",
                      "radial-gradient(circle at 70% 58%, rgba(151,211,255,0.22), transparent 38%)",
                      "radial-gradient(circle at 24% 35%, rgba(21,184,166,0.18), transparent 34%)",
                    ],
              }
        }
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="relative z-10 grid size-10 place-items-center rounded-full bg-[var(--sauna-accent)] text-[var(--sauna-primary-contrast)] shadow-[0_12px_30px_var(--sauna-accent-shadow)]"
        animate={{ x: night ? (compact ? 40 : 86) : 0, rotate: night ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <motion.span
          key={theme}
          initial={reduce ? false : { opacity: 0, scale: 0.75, rotate: -24 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {night ? <MoonStars size={19} weight="duotone" /> : <Sun size={19} weight="duotone" />}
        </motion.span>
      </motion.span>

      <span className="pointer-events-none absolute inset-y-0 left-12 right-12 hidden items-center justify-center text-xs font-semibold text-[var(--sauna-muted-strong)] sm:flex">
        {compact ? null : night ? "深夜" : "白天"}
      </span>

      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="pointer-events-none absolute text-[var(--sauna-accent)]"
          style={{
            left: `${compact ? 58 + index * 8 : 78 + index * 12}%`,
            top: `${24 + index * 18}%`,
          }}
          animate={reduce ? undefined : { opacity: night ? [0.15, 0.78, 0.15] : [0.05, 0.28, 0.05], scale: [0.7, 1.18, 0.7] }}
          transition={{ duration: 1.6 + index * 0.28, repeat: Infinity, ease: "easeInOut", delay: index * 0.15 }}
          aria-hidden="true"
        >
          <Sparkle size={compact ? 8 : 10} weight="fill" />
        </motion.span>
      ))}
    </button>
  );
}
