"use client";

import { MouseEvent, useSyncExternalStore } from "react";
import { MoonStars, Sun } from "@phosphor-icons/react";
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
        className="absolute inset-0"
        animate={{
          background: night
            ? "radial-gradient(circle at 76% 42%, var(--sauna-glow-1), transparent 48%)"
            : "radial-gradient(circle at 24% 42%, var(--sauna-glow-2), transparent 50%)",
          opacity: night ? 0.62 : 0.86,
        }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="relative z-10 grid size-10 place-items-center rounded-full bg-[var(--sauna-accent)] text-[var(--sauna-primary-contrast)] shadow-[0_12px_30px_var(--sauna-accent-shadow)]"
        animate={{ x: night ? (compact ? 40 : 86) : 0, rotate: night ? 180 : 0 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
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

      <motion.span
        className="pointer-events-none absolute inset-y-2 rounded-full bg-[radial-gradient(circle,var(--sauna-glow-1),transparent_68%)]"
        animate={{ left: night ? "38%" : "2%", right: night ? "2%" : "38%", opacity: night ? 0.42 : 0.62 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
    </button>
  );
}
