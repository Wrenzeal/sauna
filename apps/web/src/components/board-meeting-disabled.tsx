"use client";

import { motion, useReducedMotion } from "motion/react";
import { Lock, UsersThree } from "@phosphor-icons/react";

export function BoardMeetingDisabled() {
  const reduce = useReducedMotion();

  return (
    <section className="grid min-h-[calc(100dvh-7rem)] place-items-center">
      <div className="relative w-full max-w-[920px] overflow-hidden rounded-[40px] border border-black/[0.08] bg-[#fbfbf8]/86 p-6 text-center shadow-[0_26px_90px_rgb(28_34_24_/_0.10)] backdrop-blur-xl sm:p-10">
        <motion.div
          className="pointer-events-none absolute left-[18%] top-[15%] size-44 rounded-full bg-[#dfe8f5]/80 blur-2xl"
          animate={reduce ? undefined : { x: [0, 20, 0], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative mx-auto grid size-24 place-items-center rounded-[32px] bg-[#dfe8f5] text-[#405f84]"
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <UsersThree size={34} weight="duotone" />
        </motion.div>
        <p className="relative mt-8 text-sm font-medium text-[#68707d]">董事会桑拿</p>
        <h1 className="relative mx-auto mt-3 max-w-[9ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[#171a1f] sm:text-6xl">暂未开放</h1>
        <div className="relative mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-[#eef0eb] px-4 py-2 text-sm text-[#4e5660]">
          <Lock size={16} /> 501
        </div>
      </div>
    </section>
  );
}
