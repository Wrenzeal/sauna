"use client";

import {
  ArrowRight,
  Clock,
  DotsThreeCircle,
  Brain,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { AgentProfile } from "@/types/sauna";
import { SteamParticles } from "@/components/steam-particles";

const statusText: Record<AgentProfile["status"], string> = {
  idle: "待命",
  thinking: "思考中",
  in_conversation: "咨询中",
  offline: "离线",
};

const statusClass: Record<AgentProfile["status"], string> = {
  idle: "text-[var(--sauna-accent-strong)]",
  thinking: "text-[var(--sauna-muted-strong)]",
  in_conversation: "text-[var(--sauna-accent-strong)]",
  offline: "text-[var(--sauna-muted)]",
};

const statusGlow: Record<AgentProfile["status"], string> = {
  idle: "var(--sauna-glow-idle)",
  thinking: "var(--sauna-glow-thinking)",
  in_conversation: "var(--sauna-glow-active)",
  offline: "transparent",
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
  const delay = delayFromId(agent.id);
  const isBusy = agent.status === "thinking" || agent.status === "in_conversation";

  return (
    <motion.article
      layout
      whileHover={reduce ? undefined : { y: -8, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="group relative h-full min-h-[380px] overflow-visible rounded-[32px] outline-none"
    >
      {/* Glow background */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-12 h-48 w-[80%] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: statusGlow[agent.status] }}
        animate={
          reduce
            ? undefined
            : {
                opacity: selected ? [0.5, 0.8, 0.5] : isBusy ? [0.3, 0.6, 0.3] : [0.2, 0.4, 0.2],
                scale: selected ? [0.95, 1.08, 0.95] : [0.9, 1, 0.9],
              }
        }
        transition={{ duration: isBusy ? 2.2 : 4.5, repeat: Infinity, ease: "easeInOut", delay }}
      />

      {/* Main card */}
      <button
        type="button"
        onClick={() => onSelect?.(agent.id)}
        className="relative block h-[286px] w-full rounded-[32px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--sauna-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sauna-bg)] active:translate-y-px"
        aria-label={`选择${agent.displayName}`}
      >
        {/* Workstation container */}
        <motion.div
          className="absolute inset-x-0 top-0 h-[286px]"
          animate={
            reduce
              ? undefined
              : {
                  y: selected ? [0, -6, 0] : [0, -3, 0],
                }
          }
          transition={{ duration: isBusy ? 2.8 : 4.2, repeat: Infinity, ease: "easeInOut", delay }}
        >
          {/* Distillation tank */}
          <motion.div
            className="absolute left-1/2 top-6 z-30 h-[200px] w-[86%] max-w-[320px] -translate-x-1/2 overflow-hidden rounded-[36px] border-[6px] border-[color:var(--sauna-line)] bg-gradient-to-br from-[var(--sauna-panel)] via-[var(--sauna-panel-strong)] to-[var(--sauna-soft)] shadow-[var(--sauna-shadow)]"
            whileHover={reduce ? undefined : { y: -2 }}
          >
            {/* Glass effect overlay */}
            <div className="absolute inset-[8px] rounded-[28px] bg-[var(--sauna-tank-glass)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.15)]" />

            {/* Steam particles inside tank */}
            <SteamParticles
              density={isBusy ? "dense" : selected ? "medium" : "light"}
              speed={isBusy ? "fast" : "normal"}
            />

            {/* Agent display */}
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <motion.div
                animate={
                  reduce
                    ? undefined
                    : {
                        y: isBusy ? [0, -4, 0] : [0, -2, 0],
                      }
                }
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay }}
                className="min-w-0"
              >
                {/* Avatar emoji */}
                <motion.div
                  className="mx-auto mb-4 grid size-20 place-items-center rounded-[28px] bg-[var(--sauna-soft-strong)] text-4xl shadow-[var(--sauna-shadow)]"
                  animate={
                    reduce
                      ? undefined
                      : isBusy
                        ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }
                        : { scale: [1, 1.02, 1] }
                  }
                  transition={{ duration: isBusy ? 1.8 : 3.2, repeat: Infinity, ease: "easeInOut", delay }}
                >
                  {agent.avatarSeed || "🧠"}
                </motion.div>

                {/* Name and role */}
                <h2
                  className="truncate text-3xl font-semibold leading-none tracking-[-0.06em] text-[var(--sauna-text)] sm:text-[36px]"
                  title={agent.displayName}
                >
                  {agent.displayName}
                </h2>
                <p
                  className="mx-auto mt-2 max-w-[20ch] truncate text-sm font-medium text-[var(--sauna-muted-strong)]"
                  title={agent.role}
                >
                  {agent.role}
                </p>
              </motion.div>
            </div>

            {/* Status indicator bar at bottom */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-1.5 bg-[var(--sauna-accent)]"
              animate={
                reduce
                  ? undefined
                  : {
                      opacity: isBusy ? [0.5, 1, 0.5] : selected ? [0.6, 0.9, 0.6] : [0.2, 0.5, 0.2],
                      scaleX: isBusy ? [0.7, 1, 0.7] : selected ? [0.8, 1, 0.8] : [0.4, 0.7, 0.4],
                    }
              }
              transition={{ duration: isBusy ? 1.5 : 2.8, repeat: Infinity, ease: "easeInOut", delay }}
            />
          </motion.div>

          {/* Tank stand */}
          <div className="absolute left-1/2 top-[196px] z-20 h-[36px] w-[36px] -translate-x-1/2 rounded-b-[14px] bg-gradient-to-b from-[var(--sauna-stand-from)] to-[var(--sauna-stand-to)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)]" />
          <div className="absolute left-1/2 top-[222px] z-30 h-[14px] w-[28%] max-w-[110px] -translate-x-1/2 rounded-[12px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft-strong)] shadow-[var(--sauna-shadow)]" />
        </motion.div>

        {/* Status badge */}
        <div
          className={`absolute left-6 top-[204px] z-40 inline-flex items-center gap-1.5 rounded-full bg-[var(--sauna-panel-strong)] px-3 py-1 text-xs font-medium shadow-[var(--sauna-shadow)] ${statusClass[agent.status]}`}
        >
          {isBusy ? (
            <motion.span
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Brain size={14} weight="duotone" />
            </motion.span>
          ) : (
            <DotsThreeCircle size={14} weight="duotone" />
          )}
          {statusText[agent.status]}
        </div>
      </button>

      {/* Action bar */}
      <div className="relative z-50 -mt-8 px-3 text-center">
        <div className="relative mx-auto grid w-full max-w-[318px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[28px] border border-[color:var(--sauna-inner-line)] bg-[var(--sauna-panel-strong)] p-2 shadow-[var(--sauna-shadow)] backdrop-blur-xl">
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[62%] -translate-x-1/2 bg-[var(--sauna-accent)]" />
          <button
            type="button"
            onClick={() => onSelect?.(agent.id)}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs transition active:translate-y-px ${
              selected
                ? "bg-[var(--sauna-accent-soft)] font-semibold text-[var(--sauna-accent-strong)] shadow-[var(--sauna-shadow)]"
                : "text-[var(--sauna-muted)] hover:bg-[var(--sauna-soft-strong)] hover:text-[var(--sauna-text)]"
            }`}
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
            {opening ? "预热中" : "进入桑拿房"}
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
