"use client";

import {
  ArrowRight,
  Clock,
  DotsThreeCircle,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { AgentProfile } from "@/types/sauna";

const statusText: Record<AgentProfile["status"], string> = {
  idle: "待命",
  thinking: "思考中",
  in_conversation: "咨询中",
  offline: "离线",
};

const toneClass: Record<string, { glow: string; accent: string; text: string; soft: string; wash: string }> = {
  emerald: {
    glow: "bg-[#f3dcc2]",
    accent: "bg-[#b77945]",
    text: "text-[#7a4728]",
    soft: "bg-[#f5e8d7]",
    wash: "from-[#2f2017] via-[#3b2618] to-[#5a3824]",
  },
  cyan: {
    glow: "bg-[#f3dcc2]",
    accent: "bg-[#b77945]",
    text: "text-[#7a4728]",
    soft: "bg-[#f5e8d7]",
    wash: "from-[#2f2017] via-[#3b2618] to-[#5a3824]",
  },
  amber: {
    glow: "bg-[#f3dcc2]",
    accent: "bg-[#b77945]",
    text: "text-[#7a4728]",
    soft: "bg-[#f5e8d7]",
    wash: "from-[#2f2017] via-[#3b2618] to-[#5a3824]",
  },
  rose: {
    glow: "bg-[#f3dcc2]",
    accent: "bg-[#b77945]",
    text: "text-[#7a4728]",
    soft: "bg-[#f5e8d7]",
    wash: "from-[#2f2017] via-[#3b2618] to-[#5a3824]",
  },
};

const statusClass: Record<AgentProfile["status"], string> = {
  idle: "text-[#7a4728]",
  thinking: "text-[#7b5a3e]",
  in_conversation: "text-[#7a4728]",
  offline: "text-[#9a876f]",
};

function delayFromId(id: string) {
  return (Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7) * 0.16;
}

export function AgentCard({
  agent,
  selected = false,
  opening = false,
  onSelect,
  onOpen,
}: {
  agent: AgentProfile;
  selected?: boolean;
  opening?: boolean;
  onSelect?: (agentId: string) => void;
  onOpen?: (agentId: string) => void;
}) {
  const reduce = useReducedMotion();
  const tone = toneClass[agent.accent] ?? toneClass.emerald;
  const delay = delayFromId(agent.id);
  const loop = reduce ? undefined : { duration: 6.4, repeat: Infinity, ease: "easeInOut" as const, delay };

  return (
    <motion.article
      layout
      whileHover={reduce ? undefined : { y: -6, scale: 1.008 }}
      transition={{ type: "spring", stiffness: 250, damping: 26 }}
      className="group relative h-full min-h-[380px] overflow-visible rounded-[32px] outline-none"
    >
      <motion.div
        className={`pointer-events-none absolute left-1/2 top-10 h-56 w-[86%] -translate-x-1/2 rounded-full ${tone.glow} blur-3xl`}
        animate={reduce ? undefined : { opacity: selected ? [0.44, 0.74, 0.44] : [0.24, 0.46, 0.24], scale: selected ? [0.96, 1.05, 0.96] : [0.92, 1, 0.92] }}
        transition={loop}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[86px] left-1/2 h-14 w-[66%] -translate-x-1/2 rounded-full bg-[#6d4a34]/12 blur-xl"
        animate={reduce ? undefined : { opacity: selected ? [0.36, 0.58, 0.36] : [0.24, 0.42, 0.24], scaleX: selected ? [0.9, 1.04, 0.9] : [0.84, 0.96, 0.84] }}
        transition={loop}
      />

      <button
        type="button"
        onClick={() => onSelect?.(agent.id)}
        className="relative block h-[286px] w-full rounded-[32px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#b77945]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8efe3] active:translate-y-px"
        aria-label={`选择${agent.displayName}`}
      >
        <motion.div
          className="absolute inset-x-0 top-0 h-[286px]"
          animate={reduce ? undefined : { y: selected ? [0, -5, 0] : [0, -3, 0], rotate: selected ? [0, -0.18, 0.14, 0] : [0, -0.1, 0.08, 0] }}
          transition={loop}
        >
          <motion.div
            className={`absolute left-1/2 top-7 z-30 h-[176px] w-[86%] max-w-[336px] -translate-x-1/2 overflow-hidden rounded-[30px] border-[8px] border-[#eadcc8] bg-gradient-to-br ${tone.wash} shadow-[0_20px_52px_rgb(84_54_32_/_0.14),inset_0_1px_0_rgb(255_255_255_/_0.16)]`}
            whileHover={reduce ? undefined : { y: -2 }}
          >
            <div className="absolute inset-[10px] rounded-[20px] bg-[#21140d]/54 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]" />
            <span className="absolute left-7 right-7 top-7 h-px bg-[#fffdf7]/24" />
            <span className="absolute left-7 right-14 top-11 h-px bg-[#fffdf7]/10" />
            <motion.span
              className="absolute -left-36 top-0 h-full w-36 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#fffdf7]/12 to-transparent"
              animate={reduce ? undefined : { x: [0, 470] }}
              transition={{ duration: selected ? 2.8 : 4.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.25 }}
            />
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <motion.div
                animate={reduce ? undefined : { y: selected ? [0, -2, 0] : [0, -1, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay }}
                className="min-w-0"
              >
                <h2 className="truncate text-4xl font-semibold leading-none tracking-[-0.075em] text-[#fff8ec] sm:text-[42px]" title={agent.displayName}>{agent.displayName}</h2>
                <p className="mx-auto mt-3 max-w-[24ch] truncate text-sm font-medium text-[#fff8ec]/56" title={agent.role}>{agent.role}</p>
              </motion.div>
            </div>
            <motion.span
              className={`absolute bottom-4 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full ${tone.accent}`}
              animate={reduce ? undefined : { opacity: selected ? [0.64, 1, 0.64] : [0.2, 0.46, 0.2], scaleX: selected ? [0.86, 1.08, 0.86] : [0.52, 0.8, 0.52] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
            />
          </motion.div>

          <div className="absolute left-1/2 top-[202px] z-20 h-[42px] w-[42px] -translate-x-1/2 rounded-b-[15px] bg-gradient-to-b from-[#e2cfb7] to-[#c9b49a] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.76)]" />
          <div className="absolute left-1/2 top-[232px] z-30 h-[16px] w-[34%] max-w-[128px] -translate-x-1/2 rounded-[14px] border border-[#563a24]/[0.08] bg-[#eadcc8] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.8),0_10px_18px_rgb(84_54_32_/_0.06)]" />
        </motion.div>

        <div className={`absolute left-6 top-[214px] z-40 inline-flex items-center gap-1.5 rounded-full bg-[#fffdf7]/86 px-3 py-1 text-xs font-medium shadow-[0_8px_18px_rgb(84_54_32_/_0.08)] ${statusClass[agent.status]}`}>
          <DotsThreeCircle size={14} weight="duotone" />
          {statusText[agent.status]}
        </div>
      </button>

      <div className="relative z-50 -mt-8 px-3 text-center">
        <div className="relative mx-auto grid w-full max-w-[318px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[28px] border border-[#fff8ec]/72 bg-[#fffdf7]/78 p-2 shadow-[0_18px_42px_rgb(84_54_32_/_0.09),inset_0_1px_0_rgb(255_255_255_/_0.9)] backdrop-blur-xl">
          <div className={`pointer-events-none absolute left-1/2 top-0 h-px w-[62%] -translate-x-1/2 ${tone.accent}`} />
          <button
            type="button"
            onClick={() => onSelect?.(agent.id)}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs transition active:translate-y-px ${selected ? `${tone.text} ${tone.soft} font-semibold shadow-[0_8px_16px_rgb(84_54_32_/_0.06)]` : "text-[var(--sauna-muted)] hover:bg-[#f2e4d2] hover:text-[var(--sauna-text)]"}`}
          >
            <Clock size={14} />
            <span className="truncate">{selected ? "当前对象" : agent.lastActivity}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpen?.(agent.id)}
            disabled={opening}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--sauna-espresso)] px-4 text-sm font-semibold text-[#fff8ec] shadow-[0_10px_22px_rgb(74_48_32_/_0.16)] transition hover:bg-[var(--sauna-espresso-2)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#baa48b]"
          >
            {opening ? "开启中" : "咨询"}
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
