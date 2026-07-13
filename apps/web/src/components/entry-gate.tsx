"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MouseEvent, useEffect, useState } from "react";
import { ArrowRight, Brain, Info, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/access-coordinator";
import { motionDuration, saunaEase } from "@/lib/motion-system";

const experts = [
  { name: "乔布斯", role: "产品直觉", avatar: "🍎" },
  { name: "马斯克", role: "第一性原理", avatar: "🚀" },
  { name: "比尔盖茨", role: "系统思维", avatar: "💻" },
  { name: "周受资", role: "全球增长", avatar: "📱" },
] as const;

export function EntryGate() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [introOpen, setIntroOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [curtainOrigin, setCurtainOrigin] = useState({ x: 50, y: 55 });

  function enterLobby(event: MouseEvent<HTMLButtonElement>) {
    if (entering) return;
    if (reduce) {
      router.push("/lobby");
      return;
    }
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    setCurtainOrigin({ x, y });
    setEntering(true);
    window.sessionStorage.setItem("sauna-entry-curtain", "1");
    window.setTimeout(() => router.push("/lobby"), 560);
  }

  useEffect(() => {
    if (!introOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setIntroOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [introOpen]);

  return (
    <motion.main animate={entering && !reduce ? { scale: 0.975, filter: "blur(8px)", opacity: 0.34 } : { scale: 1, filter: "blur(0px)", opacity: 1 }} transition={{ duration: 0.62, ease: saunaEase }} className="relative min-h-[100dvh] overflow-hidden bg-[var(--sauna-bg)] text-[var(--sauna-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,var(--sauna-glow-2),transparent_28rem),radial-gradient(circle_at_12%_86%,var(--sauna-glow-1),transparent_30rem)]" />
      <motion.div className="pointer-events-none absolute -left-[8%] top-[5%] h-[72%] w-[48%] -skew-x-12 bg-[linear-gradient(112deg,var(--sauna-glow-2),transparent)] blur-2xl" animate={reduce ? undefined : { x: ["-3%", "5%", "-3%"], opacity: [0.45, 0.72, 0.45] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />

      <header className="relative z-20 mx-auto flex h-20 max-w-[1460px] items-center justify-between px-5 sm:px-8">
        <Link href="/lobby" className="flex items-center gap-3" aria-label="进入 Sauna">
          <span className="grid size-10 place-items-center rounded-[16px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]"><Brain size={19} weight="duotone" /></span>
          <span className="sauna-display text-xl tracking-[-0.04em]">Sauna</span>
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIntroOpen(true)} className="hidden h-11 items-center gap-2 rounded-full px-4 text-sm text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft)] sm:inline-flex"><Info size={17} /> 什么是 Sauna</button>
          <AccountMenu />
          <ThemeToggle compact />
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1460px] items-center gap-12 px-5 pb-12 sm:px-8 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-sm font-medium tracking-[0.14em] text-[var(--sauna-accent-strong)]">PERSONAL BRAIN TRUST</p>
          <h1 className="sauna-display mt-6 max-w-[9ch] text-6xl leading-[0.94] tracking-[-0.06em] sm:text-7xl lg:text-[88px]">坐下来，听听他们怎么想。</h1>
          <p className="mt-7 max-w-[30ch] text-lg leading-8 text-[var(--sauna-muted-strong)]">一处安静的私人空间，让你和真正值得学习的思维方式认真聊一聊。</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <motion.button type="button" onClick={enterLobby} disabled={entering} whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.985 }} className="group inline-flex h-13 items-center gap-3 rounded-full bg-[var(--sauna-primary)] px-6 text-sm font-semibold text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition-colors hover:bg-[var(--sauna-primary-hover)] disabled:pointer-events-none">{entering ? "正在为你开门" : "进入桑拿房"} <motion.span animate={entering && !reduce ? { x: [0, 4, 0] } : undefined} transition={{ duration: 0.8, repeat: Infinity }}><ArrowRight size={17} /></motion.span></motion.button>
            <button type="button" onClick={() => setIntroOpen(true)} className="inline-flex h-13 items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-5 text-sm font-semibold text-[var(--sauna-muted-strong)] shadow-[var(--sauna-shadow-soft)] transition hover:-translate-y-0.5 active:translate-y-px"><Info size={17} /> 了解 Sauna</button>
          </div>
        </motion.div>

        <motion.div initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="relative rounded-[38px] border border-[color:var(--sauna-line)] bg-[color-mix(in_srgb,var(--sauna-panel)_86%,transparent)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-[var(--sauna-accent)]" />
          <div className="mb-6 flex items-end justify-between gap-4">
            <div><p className="text-sm text-[var(--sauna-muted)]">今晚在场</p><h2 className="sauna-display mt-1 text-3xl tracking-[-0.04em]">你的智囊团</h2></div>
            <span className="rounded-full bg-[var(--sauna-accent-soft)] px-3 py-1.5 text-xs text-[var(--sauna-accent-strong)]">4 位待命</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {experts.map((expert, index) => (
              <motion.div key={expert.name} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.16 + index * 0.06 }} className="flex items-center gap-4 rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-4 shadow-[0_12px_34px_var(--sauna-shadow-soft)]">
                <span className="grid size-12 place-items-center rounded-[18px] bg-[var(--sauna-soft)] text-2xl">{expert.avatar}</span>
                <div><p className="sauna-display text-xl text-[var(--sauna-text)]">{expert.name}</p><p className="mt-1 text-xs text-[var(--sauna-muted)]">{expert.role}</p></div>
              </motion.div>
            ))}
          </div>
          <div className="mt-5 rounded-[24px] bg-[var(--sauna-primary)] p-5 text-[var(--sauna-primary-contrast)]"><p className="text-xs tracking-[0.14em] text-[var(--sauna-primary-contrast-muted)]">THE ROOM IS READY</p><p className="sauna-display mt-3 text-2xl">先选一个人，再说出你的问题。</p></div>
        </motion.div>
      </section>

      <AnimatePresence>
        {introOpen ? (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-[var(--sauna-scrim)] px-4 py-8 backdrop-blur-md" role="presentation" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setIntroOpen(false)}>
            <motion.section role="dialog" aria-modal="true" aria-labelledby="sauna-intro-title" className="relative w-full max-w-[620px] overflow-hidden rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)] sm:p-8" initial={reduce ? false : { opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => setIntroOpen(false)} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-[var(--sauna-soft)] text-[var(--sauna-muted)]" aria-label="关闭介绍"><X size={17} /></button>
              <span className="grid size-13 place-items-center rounded-[20px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]"><Brain size={23} weight="duotone" /></span>
              <p className="mt-7 text-sm text-[var(--sauna-accent-strong)]">Personal AI Brain Trust</p>
              <h2 id="sauna-intro-title" className="sauna-display mt-2 text-4xl tracking-[-0.05em] sm:text-5xl">什么是 Sauna？</h2>
              <div className="mt-6 grid gap-4 text-sm leading-7 text-[var(--sauna-muted-strong)]"><p>Sauna 是你的个人 AI 智囊团工作空间。</p><p>默认智囊来自已经蒸馏好的 Skill；你也可以在蒸馏车间创建想学习的人物。</p><p>咨询时系统加载对应 Skill，并使用你配置的大模型进行真实、流式的回答。</p></div>
              <div className="mt-8 flex flex-wrap gap-3"><Link href="/lobby" onClick={() => setIntroOpen(false)} className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)]">进入桑拿房 <ArrowRight size={16} /></Link><Link href="/studio" onClick={() => setIntroOpen(false)} className="inline-flex h-12 items-center rounded-full border border-[color:var(--sauna-line)] px-5 text-sm font-semibold text-[var(--sauna-muted-strong)]">开始蒸馏</Link></div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
          <AnimatePresence>
        {entering && !reduce ? (
          <motion.div
            className="fixed inset-0 z-[80] pointer-events-none"
            style={{ background: `radial-gradient(circle at ${curtainOrigin.x}% ${curtainOrigin.y}%, var(--sauna-panel-strong) 0%, var(--sauna-accent-soft) 24%, var(--sauna-glow-2) 46%, var(--sauna-panel-strong) 72%)` }}
            initial={{ clipPath: `circle(0% at ${curtainOrigin.x}% ${curtainOrigin.y}%)`, opacity: 0.2 }}
            animate={{ clipPath: `circle(155% at ${curtainOrigin.x}% ${curtainOrigin.y}%)`, opacity: 1 }}
            transition={{ duration: motionDuration.curtain, ease: saunaEase }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}
