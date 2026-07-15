"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionDuration, saunaEase } from "@/lib/motion-system";
import { focusDraftKey } from "@/lib/access-policy";
import { useAccessUIStore } from "@/store/access-ui-store";
import { ArrowRight, PaperPlaneTilt, Plus, WarningCircle } from "@phosphor-icons/react";
import { AgentCard } from "@/components/agent-card";
import { useSaunaStore } from "@/store/sauna-store";

export function LobbyOverview() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const {
    agents,
    selectedAgentId,
    token,
    providers,
    apiStatus,
    sessionStatus,
    focusError,
    setSelectedAgentId,
    loadPublicAgents,
    loadIdentity,
    loadProviders,
    queueInitialPrompt,
  } = useSaunaStore();
  const [question, setQuestion] = useState("");
  const [openingAgentId, setOpeningAgentId] = useState<string>();
  const pendingIntent = useAccessUIStore((state) => state.auth.intent);

  useEffect(() => {
    void loadPublicAgents();
    void loadIdentity().catch(() => undefined);
  }, [loadIdentity, loadPublicAgents]);

  useEffect(() => {
    const restore = (event: Event) => {
      const intent = (event as CustomEvent<typeof pendingIntent>).detail;
      if (intent.kind !== "consultation" || intent.draft.sourceRoute !== "/lobby") return;
      setSelectedAgentId(intent.draft.agentId);
      setQuestion(intent.draft.content);
    };
    window.addEventListener("sauna-auth-complete", restore);
    return () => window.removeEventListener("sauna-auth-complete", restore);
  }, [setSelectedAgentId]);

  const safeAgents = agents ?? [];
  const publicAgents = safeAgents.filter((agent) => agent.sourceKind === "public");
  const privateAgents = token ? safeAgents.filter((agent) => agent.sourceKind === "private") : [];
  const safeProviders = providers ?? [];
  const activeAgentId = safeAgents.some((agent) => agent.id === selectedAgentId) ? selectedAgentId : "";
  const activeAgent = safeAgents.find((agent) => agent.id === activeAgentId);
  const providerReady = safeProviders.length > 0;
  const apiUnavailable = apiStatus === "error";

  function handleOpen(agentId: string, prompt?: string, requestAutoSend = false) {
    if (!agentId) return;
    const promptText = prompt?.trim() ?? "";
    if (promptText) {
      queueInitialPrompt(focusDraftKey(agentId), { content: promptText, autoSend: Boolean(requestAutoSend && token && providerReady) });
    }
    setOpeningAgentId(agentId);
    router.push(`/focus-room/new?agentId=${encodeURIComponent(agentId)}`);
    if (promptText) setQuestion("");
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAgentId || !question.trim()) return;
    handleOpen(activeAgentId, question, true);
  }

  return (
    <section className="relative min-h-[calc(100dvh-7rem)] overflow-hidden rounded-[38px] border border-[color:var(--sauna-line)] bg-[color-mix(in_srgb,var(--sauna-panel)_84%,transparent)] px-4 pb-8 pt-8 shadow-[var(--sauna-shadow)] sm:px-7 lg:px-10 lg:pt-12">
      <div className="pointer-events-none absolute -left-20 top-0 h-[420px] w-[55%] -skew-x-12 bg-[linear-gradient(115deg,var(--sauna-glow-2),transparent)] opacity-75 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[var(--sauna-glow-1)] blur-3xl" />

      <motion.header initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto max-w-[1180px] py-8 text-center sm:py-12">
        <p className="text-sm font-medium tracking-[0.12em] text-[var(--sauna-accent-strong)]">你的私人智囊会所</p>
        <h1 className="sauna-display mx-auto mt-5 whitespace-nowrap text-[clamp(2.35rem,6vw,4.75rem)] leading-[0.98] tracking-[-0.055em] text-[var(--sauna-text)]">
          欢迎回来，慢慢聊。
        </h1>
        <p className="mx-auto mt-6 max-w-[34ch] text-base leading-7 text-[var(--sauna-muted-strong)] sm:text-lg">
          你的智囊团已在各自的工位待命。先选一位，再把今天最重要的问题交给他。
        </p>
      </motion.header>

      <div className="relative mx-auto mt-4 max-w-[1280px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--sauna-muted)]">Brain trust</p>
            <h2 className="sauna-display mt-1 text-3xl tracking-[-0.04em] text-[var(--sauna-text)] sm:text-4xl">选择你的咨询对象</h2>
          </div>
          <Link href="/studio" className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-5 text-sm font-semibold text-[var(--sauna-text)] shadow-[var(--sauna-shadow-soft)] transition hover:-translate-y-0.5 hover:border-[color:var(--sauna-line-strong)] active:translate-y-px">
            <Plus size={16} weight="bold" /> 新增智囊
          </Link>
        </div>

        {privateAgents.length ? <section id="my-advisors" className="mb-10"><div className="mb-5"><p className="text-sm text-[var(--sauna-muted)]">Private collection</p><h3 className="sauna-display mt-1 text-3xl">我的智囊</h3></div><motion.div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>{privateAgents.map((agent) => <motion.div key={agent.id} className="h-full" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}><AgentCard agent={agent} selected={activeAgentId === agent.id} opening={openingAgentId === agent.id} onSelect={setSelectedAgentId} onOpen={(id) => void handleOpen(id)} /></motion.div>)}</motion.div></section> : token ? <section id="my-advisors" className="mb-10 rounded-[28px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6"><h3 className="sauna-display text-3xl">我的智囊</h3><p className="mt-2 text-sm text-[var(--sauna-muted)]">还没有私人智囊。去蒸馏车间创建第一位。</p></section> : null}

        {publicAgents.length ? <section><div className="mb-5"><p className="text-sm text-[var(--sauna-muted)]">House advisors</p><h3 className="sauna-display mt-1 text-3xl">默认智囊</h3></div><motion.div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>{publicAgents.map((agent) => <motion.div key={agent.id} className="h-full" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}><AgentCard agent={agent} selected={activeAgentId === agent.id} opening={openingAgentId === agent.id} onSelect={setSelectedAgentId} onOpen={(id) => void handleOpen(id)} /></motion.div>)}</motion.div></section> : <div className="grid min-h-[360px] place-items-center rounded-[30px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-8 text-center"><div><WarningCircle size={30} className="mx-auto text-[var(--sauna-danger)]" /><h2 className="sauna-display mt-4 text-3xl">{apiUnavailable ? "后端暂不可用" : "还没有智囊"}</h2></div></div>}

        <motion.div layout className="sticky bottom-4 z-30 mx-auto mt-7 max-w-[900px]" transition={{ duration: motionDuration.component, ease: saunaEase }}>
          <AnimatePresence mode="wait" initial={false}>
          {activeAgent ? (
            <motion.form key={activeAgent.id} onSubmit={submitQuestion} initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: motionDuration.component, ease: saunaEase }} className="rounded-[28px] border border-[color:var(--sauna-line-strong)] bg-[color-mix(in_srgb,var(--sauna-panel-strong)_94%,transparent)] p-3 shadow-[var(--sauna-shadow)] backdrop-blur-2xl">
              <div className="flex items-center gap-3 px-2 pb-3">
                <span className="grid size-10 place-items-center rounded-[15px] bg-[var(--sauna-soft)] text-xl">{activeAgent.avatarSeed || "🧠"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--sauna-text)]">与 {activeAgent.displayName} 开始一次认真咨询</p>
                  <p className="truncate text-xs text-[var(--sauna-muted)]">{activeAgent.quote || activeAgent.role}</p>
                </div>
                {!token ? <span className="text-xs text-[var(--sauna-accent-strong)]">需要登录</span> : !providerReady ? <span className="text-xs text-[var(--sauna-accent-strong)]">需要模型配置</span> : null}
              </div>
              <div className="flex items-center gap-3 rounded-[21px] bg-[var(--sauna-soft)] px-4 py-3">
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} className="h-10 max-h-32 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-[var(--sauna-text)] outline-none placeholder:text-[var(--sauna-muted)]" placeholder={token && providerReady ? "今天最想和他聊什么？" : "选择后继续完成登录或模型配置"} />
                <button type="button" onClick={() => handleOpen(activeAgent.id, question, false)} disabled={sessionStatus === "loading"} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[color:var(--sauna-line-strong)] bg-[var(--sauna-panel-strong)] px-4 text-sm font-semibold text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft-strong)] disabled:opacity-40">进入咨询室 <ArrowRight size={14} /></button>
                <button type="submit" disabled={sessionStatus === "loading" || !question.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40" aria-label="开始咨询"><PaperPlaneTilt size={17} weight="fill" /></button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="workstation-hint" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-sm text-[var(--sauna-muted)]"><ArrowRight size={15} /> 选择一个工位，咨询入口会在这里出现</motion.div>
          )}
          </AnimatePresence>
        </motion.div>

        {focusError ? <div className="mx-auto mt-4 max-w-[900px] rounded-[20px] bg-[var(--sauna-danger-soft)] px-4 py-3 text-sm text-[var(--sauna-danger-strong)]">{focusError}</div> : null}
      </div>
    </section>
  );
}
