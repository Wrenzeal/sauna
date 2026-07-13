"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { motionDuration, routeDepth, saunaEase } from "@/lib/motion-system";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const previousPath = useRef(pathname);
  const [direction, setDirection] = useState(1);
  const [lobbyArrival, setLobbyArrival] = useState(false);

  useEffect(() => {
    setDirection(routeDepth(pathname) >= routeDepth(previousPath.current) ? 1 : -1);
    previousPath.current = pathname;
    if (pathname === "/lobby" && window.sessionStorage.getItem("sauna-entry-curtain") === "1") {
      window.sessionStorage.removeItem("sauna-entry-curtain");
      setLobbyArrival(true);
      const timer = window.setTimeout(() => setLobbyArrival(false), 900);
      return () => window.clearTimeout(timer);
    }
  }, [pathname]);

  const horizontal = pathname.startsWith("/focus-room") ? 0 : direction * 34;
  const vertical = pathname.startsWith("/focus-room") ? 28 : 0;

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          initial={reduce ? false : { opacity: 0, x: horizontal, y: vertical, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
          exit={reduce ? undefined : { opacity: 0, x: -horizontal * 0.65, y: -vertical * 0.35, filter: "blur(6px)" }}
          transition={{ duration: motionDuration.page, ease: saunaEase }}
          className="will-change-transform"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {lobbyArrival && !reduce ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[70] bg-[radial-gradient(circle_at_50%_54%,var(--sauna-panel-strong)_0%,var(--sauna-accent-soft)_28%,transparent_72%)]"
            initial={{ opacity: 1, scale: 1.08 }}
            animate={{ opacity: 0, scale: 1.34 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.86, ease: saunaEase }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
