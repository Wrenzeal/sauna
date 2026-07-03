"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Brain, Fire } from "@phosphor-icons/react";
import { SteamParticles } from "@/components/steam-particles";
import { TemperatureGauge } from "@/components/temperature-gauge";
import type { AgentProfile } from "@/types/sauna";

export function SaunaPreparationModal({
  agent,
  onComplete,
  skipable = true,
}: {
  agent: AgentProfile;
  onComplete: () => void;
  skipable?: boolean;
}) {
  const reduce = useReducedMotion();
  const [temperature, setTemperature] = useState(20);
  const [phase, setPhase] = useState<"heating" | "ready">("heating");

  useEffect(() => {
    const duration = reduce ? 100 : 1500;
    const interval = duration / 60;
    let current = 20;

    const timer = setInterval(() => {
      current += 1;
      setTemperature(current);
      if (current >= 80) {
        clearInterval(timer);
        setPhase("ready");
        setTimeout(onComplete, reduce ? 100 : 500);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete, reduce]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center bg-[var(--sauna-scrim)] px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.01 : 0.3 }}
      onClick={skipable ? onComplete : undefined}
    >
      <motion.div
        className="relative overflow-hidden rounded-[42px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-8 shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-12"
        initial={reduce ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: "520px", width: "100%" }}
      >
        <SteamParticles density={phase === "ready" ? "dense" : "medium"} speed={phase === "ready" ? "fast" : "normal"} />

        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--sauna-accent-soft)] via-transparent to-[var(--sauna-accent-soft)]"
          animate={
            reduce
              ? undefined
              : {
                  opacity: phase === "ready" ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
                }
          }
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative text-center">
          <motion.div
            className="mx-auto grid size-28 place-items-center rounded-[32px] bg-[var(--sauna-primary)] text-5xl shadow-[var(--sauna-shadow)]"
            animate={
              reduce
                ? undefined
                : {
                    scale: phase === "ready" ? [1, 1.08, 1] : [1, 1.02, 1],
                    rotate: phase === "ready" ? [0, 3, -3, 0] : [0, 1, -1, 0],
                  }
            }
            transition={{ duration: phase === "ready" ? 0.8 : 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            {agent.avatarSeed ?? "🧠"}
          </motion.div>

          <h2 className="mt-8 text-3xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)] sm:text-4xl">{agent.displayName}</h2>
          <p className="mt-2 text-base text-[var(--sauna-muted-strong)]">{agent.role}</p>

          <div className="mt-10 flex flex-col items-center gap-5">
            <TemperatureGauge temperature={temperature} size="lg" showLabel />

            <motion.div
              className="flex items-center gap-2 text-sm font-semibold"
              style={{
                color: phase === "ready" ? "var(--sauna-accent-strong)" : "var(--sauna-muted-strong)",
              }}
              animate={
                reduce
                  ? undefined
                  : phase === "ready"
                    ? { opacity: [0.7, 1, 0.7] }
                    : undefined
              }
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              {phase === "heating" ? (
                <>
                  <Fire size={18} weight="duotone" />
                  正在为您预热桑拿房...
                </>
              ) : (
                <>
                  <Brain size={18} weight="duotone" />
                  桑拿房已就绪
                </>
              )}
            </motion.div>
          </div>

          {skipable && (
            <p className="mt-8 text-xs text-[var(--sauna-muted)]">点击任意位置跳过</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
