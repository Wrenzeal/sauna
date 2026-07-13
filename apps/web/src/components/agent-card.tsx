"use client";

import { ArrowRight, Brain, Circle } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { motionDuration, saunaEase } from "@/lib/motion-system";
import type { AgentProfile } from "@/types/sauna";

const statusText: Record<AgentProfile["status"], string> = {
  idle: "待命",
  thinking: "正在思考",
  in_conversation: "咨询中",
  offline: "暂不可用",
};

const statusClass: Record<AgentProfile["status"], string> = {
  idle: "text-[var(--sauna-success)]",
  thinking: "text-[var(--sauna-accent-strong)]",
  in_conversation: "text-[var(--sauna-accent-strong)]",
  offline: "text-[var(--sauna-muted)]",
};

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
  const unavailable = agent.status === "offline";

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: unavailable ? 0.62 : 1, y: 0 }}
      whileHover={reduce || unavailable ? undefined : { y: -4 }}
      whileTap={reduce || unavailable ? undefined : { scale: 0.992 }}
      transition={{ duration: motionDuration.component, ease: saunaEase }}
      className="group relative h-full min-h-[336px]"
    >
      <button
        type="button"
        onClick={() => onSelect?.(agent.id)}
        disabled={unavailable}
        aria-label={`选择${agent.displayName}`}
        aria-pressed={selected}
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-[30px] border p-5 text-left outline-none transition duration-300 focus-visible:ring-2 focus-visible:ring-[var(--sauna-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sauna-bg)] ${selected ? "border-[color:var(--sauna-accent)] bg-[var(--sauna-panel-strong)] shadow-[var(--sauna-shadow)]" : "border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] shadow-[0_16px_50px_var(--sauna-shadow-soft)] hover:border-[color:var(--sauna-line-strong)] hover:bg-[var(--sauna-panel-strong)]"}`}
      >
        <motion.span className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_78%_0%,var(--sauna-glow-1),transparent_64%)]" animate={{ opacity: selected ? 1 : 0.58 }} transition={{ duration: motionDuration.component, ease: saunaEase }} />
        <motion.span className="pointer-events-none absolute left-0 top-0 h-full w-[38%] bg-[linear-gradient(108deg,var(--sauna-glow-2),transparent)]" animate={{ opacity: selected ? 0.62 : 0.3, x: selected ? 8 : 0 }} transition={{ duration: motionDuration.component, ease: saunaEase }} />

        <div className="relative flex items-start justify-between gap-4">
          <span className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-3 py-1.5 text-xs font-medium ${statusClass[agent.status]}`}>
            {agent.status === "thinking" || agent.status === "in_conversation" ? (
              <motion.span animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                <Circle size={8} weight="fill" />
              </motion.span>
            ) : (
              <Circle size={8} weight="fill" />
            )}
            {statusText[agent.status]}
          </span>
          <span className="sauna-tabular text-xs text-[var(--sauna-muted)]">{agent.lastActivity}</span>
        </div>

        <div className="relative mt-8 flex flex-1 flex-col justify-between rounded-[24px] border border-[color:var(--sauna-inner-line)] bg-[linear-gradient(145deg,var(--sauna-panel-strong),var(--sauna-soft))] p-5 shadow-[inset_0_1px_0_var(--sauna-inner-line)]">
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs tracking-[0.16em] text-[var(--sauna-muted)]">PRIVATE ADVISOR</p>
              <h2 className="sauna-display mt-3 truncate text-[34px] leading-none tracking-[-0.045em] text-[var(--sauna-text)]" title={agent.displayName}>
                {agent.displayName}
              </h2>
              <p className="mt-3 truncate text-sm text-[var(--sauna-muted-strong)]" title={agent.role}>{agent.role}</p>
            </div>
            <motion.div
              className="grid size-[74px] shrink-0 place-items-center rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] text-[34px] shadow-[var(--sauna-shadow-soft)]"
              animate={{ scale: selected ? 1.035 : 1, y: selected ? -2 : 0, boxShadow: selected ? "0 16px 38px var(--sauna-accent-shadow)" : "0 10px 30px var(--sauna-shadow-soft)" }}
              transition={{ duration: motionDuration.component, ease: saunaEase }}
            >
              {agent.avatarSeed || "🧠"}
            </motion.div>
          </div>

          <blockquote className="mt-7 line-clamp-2 max-w-[34ch] text-sm leading-6 text-[var(--sauna-muted)]">
            “{agent.quote || "把复杂的问题，放到正确的框架里。"}”
          </blockquote>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-[var(--sauna-primary)] px-4 py-3 text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow-soft)]">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Brain size={16} weight="duotone" />
            {selected ? "已选为咨询对象" : "选择这位智囊"}
          </span>
          <ArrowRight size={16} className={`transition duration-300 ${selected ? "translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
        </div>
      </button>

      {selected && onOpen ? (
        <button type="button" onClick={() => onOpen(agent.id)} disabled={opening} className="sr-only">
          {opening ? "正在进入" : `进入${agent.displayName}的咨询`}
        </button>
      ) : null}
    </motion.article>
  );
}
