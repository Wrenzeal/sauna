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
    glow: "bg-[var(--sauna-accent-soft)]",
    accent: "bg-[var(--sauna-accent)]",
    text: "text-[var(--sauna-accent-strong)]",
    soft: "bg-[var(--sauna-accent-soft)]",
    wash: "from-[var(--sauna-screen-from)] via-[var(--sauna-screen-mid)] to-[var(--sauna-screen-to)]",
  },
  cyan: {
    glow: "bg-[var(--sauna-accent-soft)]",
    accent: "bg-[var(--sauna-accent)]",
    text: "text-[var(--sauna-accent-strong)]",
    soft: "bg-[var(--sauna-accent-soft)]",
    wash: "from-[var(--sauna-screen-from)] via-[var(--sauna-screen-mid)] to-[var(--sauna-screen-to)]",
  },
  amber: {
    glow: "bg-[var(--sauna-accent-soft)]",
    accent: "bg-[var(--sauna-accent)]",
    text: "text-[var(--sauna-accent-strong)]",
    soft: "bg-[var(--sauna-accent-soft)]",
    wash: "from-[var(--sauna-screen-from)] via-[var(--sauna-screen-mid)] to-[var(--sauna-screen-to)]",
  },
  rose: {
    glow: "bg-[var(--sauna-accent-soft)]",
    accent: "bg-[var(--sauna-accent)]",
    text: "text-[var(--sauna-accent-strong)]",
    soft: "bg-[var(--sauna-accent-soft)]",
    wash: "from-[var(--sauna-screen-from)] via-[var(--sauna-screen-mid)] to-[var(--sauna-screen-to)]",
  },
};

const statusClass: Record<AgentProfile["status"], string> = {
  idle: "text-[var(--sauna-accent-strong)]",
  thinking: "text-[var(--sauna-muted-strong)]",
  in_conversation: "text-[var(--sauna-accent-strong)]",
  offline: "text-[var(--sauna-muted)]",
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
        className="pointer-events-none absolute bottom-[86px] left-1/2 h-14 w-[66%] -translate-x-1/2 rounded-full bg-[var(--sauna-accent-soft)] opacity-70 blur-xl"
        animate={reduce ? undefined : { opacity: selected ? [0.36, 0.58, 0.36] : [0.24, 0.42, 0.24], scaleX: selected ? [0.9, 1.04, 0.9] : [0.84, 0.96, 0.84] }}
        transition={loop}
      />

      <button
        type="button"
        onClick={() => onSelect?.(agent.id)}
        className="relative block h-[286px] w-full rounded-[32px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--sauna-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sauna-bg)] active:translate-y-px"
        aria-label={`选择${agent.displayName}`}
      >
        <motion.div
          className="absolute inset-x-0 top-0 h-[286px]"
          animate={reduce ? undefined : { y: selected ? [0, -5, 0] : [0, -3, 0], rotate: selected ? [0, -0.18, 0.14, 0] : [0, -0.1, 0.08, 0] }}
          transition={loop}
        >
          <motion.div
            className={`absolute left-1/2 top-7 z-30 h-[176px] w-[86%] max-w-[336px] -translate-x-1/2 overflow-hidden rounded-[30px] border-[8px] border-[color:var(--sauna-monitor-frame)] bg-gradient-to-br ${tone.wash} shadow-[var(--sauna-shadow)]`}
            whileHover={reduce ? undefined : { y: -2 }}
          >
            <div className="absolute inset-[10px] rounded-[20px] bg-[var(--sauna-screen-glass)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]" />
            <span className="absolute left-7 right-7 top-7 h-px bg-[var(--sauna-panel-strong)]" />
            <span className="absolute left-7 right-14 top-11 h-px bg-[var(--sauna-panel-strong)]" />
            <motion.span
              className="absolute -left-36 top-0 h-full w-36 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[var(--sauna-panel-strong)] to-transparent"
              animate={reduce ? undefined : { x: [0, 470] }}
              transition={{ duration: selected ? 2.8 : 4.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.25 }}
            />
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <motion.div
                animate={reduce ? undefined : { y: selected ? [0, -2, 0] : [0, -1, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay }}
                className="min-w-0"
              >
                <h2 className="truncate text-4xl font-semibold leading-none tracking-[-0.075em] text-[var(--sauna-primary-contrast)] sm:text-[42px]" title={agent.displayName}>{agent.displayName}</h2>
                <p className="mx-auto mt-3 max-w-[24ch] truncate text-sm font-medium text-[var(--sauna-primary-contrast-muted)]" title={agent.role}>{agent.role}</p>
              </motion.div>
            </div>
            <motion.span
              className={`absolute bottom-4 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full ${tone.accent}`}
              animate={reduce ? undefined : { opacity: selected ? [0.64, 1, 0.64] : [0.2, 0.46, 0.2], scaleX: selected ? [0.86, 1.08, 0.86] : [0.52, 0.8, 0.52] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
            />
          </motion.div>

          <div className="absolute left-1/2 top-[202px] z-20 h-[42px] w-[42px] -translate-x-1/2 rounded-b-[15px] bg-gradient-to-b from-[var(--sauna-stand-from)] to-[var(--sauna-stand-to)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.76)]" />
          <div className="absolute left-1/2 top-[232px] z-30 h-[16px] w-[34%] max-w-[128px] -translate-x-1/2 rounded-[14px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft-strong)] shadow-[var(--sauna-shadow)]" />
        </motion.div>

        <div className={`absolute left-6 top-[214px] z-40 inline-flex items-center gap-1.5 rounded-full bg-[var(--sauna-panel-strong)] px-3 py-1 text-xs font-medium shadow-[var(--sauna-shadow)] ${statusClass[agent.status]}`}>
          <DotsThreeCircle size={14} weight="duotone" />
          {statusText[agent.status]}
        </div>
      </button>

      <div className="relative z-50 -mt-8 px-3 text-center">
        <div className="relative mx-auto grid w-full max-w-[318px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[28px] border border-[color:var(--sauna-inner-line)] bg-[var(--sauna-panel-strong)] p-2 shadow-[var(--sauna-shadow)] backdrop-blur-xl">
          <div className={`pointer-events-none absolute left-1/2 top-0 h-px w-[62%] -translate-x-1/2 ${tone.accent}`} />
          <button
            type="button"
            onClick={() => onSelect?.(agent.id)}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs transition active:translate-y-px ${selected ? `${tone.text} ${tone.soft} font-semibold shadow-[var(--sauna-shadow)]` : "text-[var(--sauna-muted)] hover:bg-[var(--sauna-soft-strong)] hover:text-[var(--sauna-text)]"}`}
          >
            <Clock size={14} />
            <span className="truncate">{selected ? "当前对象" : agent.lastActivity}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpen?.(agent.id)}
            disabled={opening}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--sauna-primary)] px-4 text-sm font-semibold text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition hover:bg-[var(--sauna-primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[var(--sauna-soft-strong)]"
          >
            {opening ? "开启中" : "咨询"}
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
