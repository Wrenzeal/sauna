"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.99, filter: "blur(8px)" }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="will-change-transform"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </motion.main>
    </AnimatePresence>
  );
}
