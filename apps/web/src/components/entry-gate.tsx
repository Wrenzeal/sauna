"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Brain, Info, Sparkle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ThemeToggle } from "@/components/theme-toggle";

const experts = [
  { name: "乔布斯", role: "产品直觉", avatar: "🍎", className: "left-[8%] top-[18%]" },
  { name: "马斯克", role: "第一性原理", avatar: "🚀", className: "right-[9%] top-[17%]" },
  { name: "比尔盖茨", role: "系统思维", avatar: "💻", className: "left-[14%] bottom-[16%]" },
  { name: "周受资", role: "全球增长", avatar: "📱", className: "right-[15%] bottom-[15%]" },
] as const;

const pulseRings = ["inset-[18%]", "inset-[28%]", "inset-[38%]"] as const;

export function EntryGate() {
  const reduce = useReducedMotion();
  const [introOpen, setIntroOpen] = useState(false);

  useEffect(() => {
    if (!introOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIntroOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [introOpen]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--sauna-steam)] text-[var(--sauna-text)]">
      <motion.div
        className="pointer-events-none absolute left-[5%] top-[8%] size-[28rem] rounded-full bg-[var(--sauna-steam)] blur-3xl"
        animate={reduce ? undefined : { x: [0, 32, 0], y: [0, 18, 0], opacity: [0.6, 0.95, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[4%] right-[6%] size-[30rem] rounded-full bg-[var(--sauna-accent-soft)] blur-3xl"
        animate={reduce ? undefined : { x: [0, -28, 0], y: [0, -22, 0], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 lg:right-8">
        <ThemeToggle />
      </div>

      <section className="relative mx-auto grid min-h-[100dvh] max-w-[1480px] items-center gap-8 px-4 py-6 pt-20 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex min-h-[48dvh] flex-col justify-between rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)] backdrop-blur-2xl sm:p-8 lg:min-h-[640px]"
        >
          <Link href="/lobby" className="flex w-fit items-center gap-3 text-sm font-semibold tracking-tight text-[var(--sauna-text)]" aria-label="进入 Sauna">
            <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)]">
              <Brain size={21} weight="duotone" />
            </span>
            Sauna
          </Link>

          <div className="mt-12 sm:mt-16">
            <h1 className="max-w-[8ch] text-6xl font-semibold leading-[0.94] tracking-[-0.08em] text-[var(--sauna-text)] sm:text-7xl lg:text-8xl">
              入席。
            </h1>
            <p className="mt-6 max-w-[18ch] text-lg leading-relaxed text-[var(--sauna-muted-strong)]">
              让智囊团开始升温。
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <motion.div whileHover={reduce ? undefined : { y: -2, scale: 1.015 }} whileTap={reduce ? undefined : { scale: 0.985 }}>
              <Link
                href="/lobby"
                className="group relative inline-flex h-13 items-center gap-3 overflow-hidden whitespace-nowrap rounded-full bg-[var(--sauna-primary)] px-6 text-sm font-semibold text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition duration-300 hover:bg-[var(--sauna-primary-hover)] hover:shadow-[var(--sauna-shadow)] active:translate-y-px"
              >
                <span className="absolute inset-y-0 -left-10 w-10 rotate-12 bg-[var(--sauna-panel-strong)] blur-sm transition duration-500 group-hover:left-[115%]" />
                进入
                <ArrowRight size={17} className="transition duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <motion.button
              type="button"
              onClick={() => setIntroOpen(true)}
              whileHover={reduce ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reduce ? undefined : { scale: 0.985 }}
              className="inline-flex h-13 items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] px-5 text-sm font-semibold text-[var(--sauna-muted-strong)] shadow-[var(--sauna-shadow)] backdrop-blur-xl transition duration-300 hover:bg-[var(--sauna-panel-strong)] hover:text-[var(--sauna-text)] hover:shadow-[var(--sauna-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sauna-accent)]"
              aria-haspopup="dialog"
              aria-expanded={introOpen}
            >
              <Info size={17} weight="duotone" />
              什么是 Sauna
            </motion.button>
            <span className="inline-flex h-13 items-center rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] px-5 text-sm font-medium text-[var(--sauna-muted)]">
              桑拿房已就绪
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.82, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative min-h-[520px] overflow-hidden rounded-[44px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] shadow-[var(--sauna-shadow)] backdrop-blur-2xl sm:min-h-[640px]"
        >
          <div className="absolute inset-4 rounded-[36px] border border-[color:var(--sauna-inner-line)] bg-gradient-to-br from-[var(--sauna-panel-strong)] via-transparent to-[var(--sauna-soft)]" />
          {pulseRings.map((ring, index) => (
            <motion.div
              key={ring}
              className={`pointer-events-none absolute ${ring} rounded-full border border-[color:var(--sauna-line)]`}
              animate={reduce ? undefined : { scale: [1, 1.025, 1], opacity: [0.55, 0.9, 0.55] }}
              transition={{ duration: 4.8 + index * 0.7, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}

          <motion.div
            className="absolute left-1/2 top-1/2 grid size-34 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[38px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] sm:size-40"
            animate={reduce ? undefined : { scale: [1, 1.045, 1], rotate: [0, -1.5, 0], boxShadow: ["0 30px 70px var(--sauna-shadow-soft)", "0 38px 86px var(--sauna-accent-shadow)", "0 30px 70px var(--sauna-shadow-soft)"] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkle size={36} weight="duotone" />
          </motion.div>

          {experts.map((expert, index) => (
            <motion.div
              key={expert.name}
              className={`absolute ${expert.className} w-34 rounded-[28px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-3 shadow-[var(--sauna-shadow)] backdrop-blur-xl transition duration-300 hover:bg-[var(--sauna-panel-strong)] hover:shadow-[var(--sauna-shadow)] sm:w-40 sm:p-4`}
              whileHover={reduce ? undefined : { y: -5, scale: 1.025 }}
              animate={reduce ? undefined : { y: [0, index % 2 ? 12 : -12, 0], x: [0, index % 2 ? -5 : 5, 0] }}
              transition={{ duration: 4.2 + index * 0.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="grid size-11 place-items-center rounded-[17px] bg-[var(--sauna-soft)] text-[24px] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.72)]" aria-hidden="true">
                {expert.avatar}
              </div>
              <p className="mt-4 text-base font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">{expert.name}</p>
              <p className="mt-1 text-xs text-[var(--sauna-muted)]">{expert.role}</p>
            </motion.div>
          ))}

          <motion.div
            className="absolute bottom-6 left-1/2 w-[min(92%,520px)] -translate-x-1/2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-2 shadow-[var(--sauna-shadow)] backdrop-blur-xl"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between gap-3 rounded-full bg-[var(--sauna-soft-strong)] px-5 py-4">
              <span className="text-sm font-medium text-[var(--sauna-muted)]">准备一次高质量提问</span>
              <span className="grid size-9 place-items-center rounded-full bg-[var(--sauna-accent)] text-[var(--sauna-primary-contrast)]">
                <ArrowRight size={16} weight="bold" />
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {introOpen && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center bg-[var(--sauna-scrim)] px-4 py-8 backdrop-blur-md"
            role="presentation"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onMouseDown={() => setIntroOpen(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="sauna-intro-title"
              className="relative w-full max-w-[640px] overflow-hidden rounded-[36px] border border-[color:var(--sauna-inner-line)] bg-[var(--sauna-panel)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-2xl sm:p-7"
              initial={reduce ? false : { opacity: 0, y: 22, scale: 0.965 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 14, scale: 0.975 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <motion.div
                className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[var(--sauna-accent-soft)] blur-3xl"
                animate={reduce ? undefined : { opacity: [0.55, 0.9, 0.55], scale: [1, 1.08, 1] }}
                transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <button
                type="button"
                onClick={() => setIntroOpen(false)}
                className="absolute right-5 top-5 z-10 grid size-10 place-items-center rounded-full bg-[var(--sauna-panel-strong)] text-[var(--sauna-muted)] shadow-[var(--sauna-shadow)] transition duration-300 hover:bg-[var(--sauna-primary)] hover:text-[var(--sauna-primary-contrast)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sauna-accent)]"
                aria-label="关闭介绍"
              >
                <X size={17} weight="bold" />
              </button>

              <div className="relative">
                <div className="grid size-13 place-items-center rounded-[22px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)]">
                  <Brain size={24} weight="duotone" />
                </div>
                <p className="mt-7 text-sm font-semibold text-[var(--sauna-accent)]">Personal AI Brain Trust</p>
                <h2 id="sauna-intro-title" className="mt-2 text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[var(--sauna-text)] sm:text-5xl">
                  什么是 Sauna？
                </h2>
                <div className="mt-6 grid gap-3 text-sm leading-6 text-[var(--sauna-muted-strong)]">
                  <p>Sauna 是你的个人 AI 智囊团桑拿房。</p>
                  <p>系统预置了一些已经通过 nuwa-skill 蒸馏好的专家视角，你可以先直接体验。</p>
                  <p>当你想学习某个人的思考方式时，可以登录后进入蒸馏车间，生成自己的专属 Skill。</p>
                  <p>对话时，Sauna 会加载对应 Skill，并使用你配置的大模型供应商、Key 和模型进行真实调用。</p>
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/lobby"
                    onClick={() => setIntroOpen(false)}
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition duration-300 hover:bg-[var(--sauna-primary-hover)] active:translate-y-px"
                  >
                    进入桑拿房
                    <ArrowRight size={16} className="transition duration-300 group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/studio"
                    onClick={() => setIntroOpen(false)}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-5 text-sm font-semibold text-[var(--sauna-muted-strong)] transition duration-300 hover:bg-[var(--sauna-soft)] active:translate-y-px"
                  >
                    开始蒸馏
                  </Link>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
