"use client";

import { motion, useReducedMotion } from "motion/react";
import { Lock, UsersThree } from "@phosphor-icons/react";

export function BoardMeetingDisabled() {
  const reduce = useReducedMotion();

  return (
    <section className="grid min-h-[calc(100dvh-7rem)] place-items-center">
      <div className="relative w-full max-w-[920px] overflow-hidden rounded-[40px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-6 text-center shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-10">
        <motion.div
          className="pointer-events-none absolute left-[18%] top-[15%] size-48 rounded-full bg-[color-mix(in_srgb,var(--sauna-accent-soft)_52%,transparent)] blur-3xl"
          animate={reduce ? undefined : { opacity: [0.32, 0.56, 0.32], scale: [1, 1.04, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative mx-auto grid size-24 place-items-center rounded-[32px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] text-[var(--sauna-muted-strong)]"
          animate={reduce ? undefined : { opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        >
          <UsersThree size={34} weight="duotone" />
        </motion.div>
        <p className="relative mt-8 text-sm font-medium text-[var(--sauna-muted)]">董事会桑拿</p>
        <h1 className="relative mx-auto mt-3 max-w-[9ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[var(--sauna-text)] sm:text-6xl">暂未开放</h1>
        <div className="relative mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 py-2 text-sm text-[var(--sauna-muted-strong)]">
          <Lock size={16} /> 501
        </div>
      </div>
    </section>
  );
}
