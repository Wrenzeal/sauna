"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ClockCounterClockwise,
  FileText,
  GearSix,
  PaperPlaneTilt,
  PencilSimple,
  Pulse,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { AgentCard } from "@/components/agent-card";
import { ApiSetupCard } from "@/components/api-setup-card";
import { useSaunaStore } from "@/store/sauna-store";

const subscribeHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeHydration, () => true, () => false);
}

function formatSessionTime(value?: string, hydrated = false) {
  if (!value) {
    return "刚刚";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  if (!hydrated) {
    return "刚刚";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) {
    return "刚刚";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function LobbyOverview() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const {
    agents,
    sessions,
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
    renameFocusSession,
    deleteFocusSession,
  } = useSaunaStore();
  const [question, setQuestion] = useState("");
  const [openingAgentId, setOpeningAgentId] = useState<string>();
  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string>();
  const hydrated = useHydrated();

  useEffect(() => {
    void loadPublicAgents();
    void loadIdentity();
  }, [loadIdentity, loadPublicAgents]);

  const safeAgents = agents ?? [];
  const safeProviders = providers ?? [];
  const safeSessions = sessions ?? [];
  const recentSessions = safeSessions.slice(0, 4);
  const activeAgentId = safeAgents.some((agent) => agent.id === selectedAgentId) ? selectedAgentId : safeAgents[0]?.id || "";
  const providerReady = safeProviders.length > 0;
  const apiUnavailable = apiStatus === "error";

  async function handleOpen(agentId: string, prompt?: string) {
    if (!agentId) {
      return;
    }
    setSelectedAgentId(agentId);
    setOpeningAgentId(agentId);
    try {
      if (token && safeProviders.length === 0) {
        await loadProviders();
      }
      const promptText = prompt?.trim() ?? "";
      const params = new URLSearchParams({ agentId });
      if (promptText) {
        params.set("prompt", promptText);
      }
      setQuestion("");
      router.push(`/focus-room/new?${params.toString()}`);
    } catch {
      // Store exposes the user-facing error in the setup area.
    } finally {
      setOpeningAgentId(undefined);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleOpen(activeAgentId, question);
  }

  function beginRename(session: { id: string; title: string; agentDisplayName?: string }) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || session.agentDisplayName || "未命名咨询");
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSessionId) {
      return;
    }
    const titleText = editingTitle.trim();
    if (!titleText) {
      return;
    }
    await renameFocusSession(editingSessionId, titleText);
    setEditingSessionId(undefined);
    setEditingTitle("");
  }

  async function confirmDeleteSession() {
    if (!pendingDeleteSessionId) {
      return;
    }
    const sessionId = pendingDeleteSessionId;
    setPendingDeleteSessionId(undefined);
    await deleteFocusSession(sessionId);
  }


  return (
    <section className="grid min-h-[calc(100dvh-7rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-4 shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-6"
      >
        <motion.div
          className="pointer-events-none absolute left-[8%] top-[8%] size-48 rounded-full bg-[var(--sauna-steam)] blur-2xl"
          animate={reduce ? undefined : { x: [0, 24, 0], y: [0, 18, 0], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute bottom-[8%] right-[8%] size-56 rounded-full bg-[var(--sauna-accent-soft)] blur-2xl"
          animate={reduce ? undefined : { x: [0, -18, 0], y: [0, -22, 0], opacity: [0.48, 0.82, 0.48] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative">
          <div className="grid gap-5">
            <div className="relative overflow-hidden rounded-[34px] bg-[var(--sauna-soft)] p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.58)] sm:p-8">
              <div className="pointer-events-none absolute right-6 top-6 hidden h-28 w-52 rounded-full bg-[var(--sauna-panel-strong)] blur-2xl sm:block" />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)] lg:items-end">
                <div>
                  <p className="text-sm font-medium text-[var(--sauna-muted)]">智囊大厅</p>
                  <h1 className="mt-4 max-w-[12ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[var(--sauna-text)] sm:text-6xl xl:text-7xl">
                    智囊就绪。
                  </h1>
                  <p className="mt-5 max-w-[28ch] text-base leading-relaxed text-[var(--sauna-muted-strong)]">
                    选一个工位，开始一次认真咨询。
                  </p>
                </div>

                <form onSubmit={submitQuestion} className="rounded-[28px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-3 shadow-[var(--sauna-shadow)]">
                  <div className="mb-3 flex items-center justify-between gap-3 px-2 text-xs text-[var(--sauna-muted)]">
                    <span>当前对象</span>
                    <span className="font-semibold text-[var(--sauna-accent-strong)]">{safeAgents.find((agent) => agent.id === activeAgentId)?.displayName ?? "选择工位"}</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-[22px] bg-[var(--sauna-steam)] px-4 py-3">
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sauna-text)] outline-none placeholder:text-[var(--sauna-muted)]"
                      placeholder={token && providerReady ? "输入一个具体问题" : "先登录并完成设置"}
                    />
                    <button
                      type="submit"
                      disabled={sessionStatus === "loading" || !activeAgentId || !question.trim()}
                      className="grid size-10 place-items-center rounded-full bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] transition hover:scale-[1.02] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[var(--sauna-soft-strong)]"
                      aria-label="进入咨询"
                    >
                      <PaperPlaneTilt size={18} weight="fill" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[34px] bg-[var(--sauna-steam)] px-3 pb-7 pt-5 sm:px-5">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[var(--sauna-text)]">专家工位</h2>
                  <p className="mt-1 text-sm text-[var(--sauna-muted)]">选择一位专家开始咨询。</p>
                </div>
                <Link href="/studio" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--sauna-primary)] px-4 text-sm font-semibold text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition hover:-translate-y-0.5 active:translate-y-px">
                  <Plus size={16} weight="bold" /> 新增工位
                </Link>
              </div>
              <div className="pointer-events-none absolute inset-x-4 top-24 hidden h-[58%] rounded-[46%] bg-[var(--sauna-soft-strong)] blur-3xl md:block" />
              <motion.div
                className="relative grid auto-rows-[380px] grid-cols-1 gap-x-3 gap-y-8 md:grid-cols-2 xl:grid-cols-3"
                initial={reduce ? false : "hidden"}
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
              >
                {safeAgents.length ? (
                  safeAgents.map((agent) => (
                    <motion.div
                      key={agent.id}
                      variants={{ hidden: { opacity: 0, y: 20, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full"
                    >
                      <AgentCard
                        agent={agent}
                        selected={activeAgentId === agent.id}
                        opening={openingAgentId === agent.id}
                        onSelect={setSelectedAgentId}
                        onOpen={(id) => void handleOpen(id)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="grid min-h-[420px] place-items-center rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-8 text-center shadow-[var(--sauna-shadow)] md:col-span-2 2xl:col-span-3">
                    <div>
                      <WarningCircle size={30} className="mx-auto text-[var(--sauna-danger-strong)]" />
                      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)]">
                        {apiUnavailable ? "后端暂不可用" : "暂无智囊"}
                      </h2>
                      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-[var(--sauna-muted)]">
                        {apiUnavailable ? "请确认 Go 后端已启动，页面不会使用本地 mock 替代真实数据。" : "数据库里还没有可用的公开智囊。"}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {pendingDeleteSessionId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--sauna-scrim)] px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="删除会话确认">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm rounded-[30px] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)]"
          >
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">删除这条咨询？</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--sauna-muted)]">删除后会清理这条会话的消息和事件记录，无法恢复。</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteSessionId(undefined)} className="h-10 rounded-full bg-[var(--sauna-soft-strong)] px-4 text-sm font-semibold text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft)]">取消</button>
              <button type="button" onClick={() => void confirmDeleteSession()} className="h-10 rounded-full bg-[var(--sauna-danger)] px-4 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-danger-strong)]">删除</button>
            </div>
          </motion.div>
        </div>
      ) : null}
      <motion.aside
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        className="grid content-start gap-4"
      >
        <ApiSetupCard />

        {focusError ? (
          <div className="flex gap-3 rounded-[28px] border border-[color:var(--sauna-line)] bg-[var(--sauna-danger-soft)] p-4 text-sm leading-relaxed text-[var(--sauna-danger-strong)] shadow-[var(--sauna-shadow)]">
            <WarningCircle size={19} className="shrink-0" />
            <span>{focusError}</span>
          </div>
        ) : null}

        <div className="rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">今日桌面</h2>
            <Pulse size={24} className="text-[var(--sauna-accent)]" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              [safeAgents.length, apiStatus === "error" ? "异常" : "工位"],
              [safeSessions.length, "会话"],
              [safeProviders.length, "接入"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[22px] bg-[var(--sauna-soft-strong)] p-3">
                <p className="text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">{value}</p>
                <p className="mt-1 text-xs text-[var(--sauna-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">最近会话</h2>
            <ClockCounterClockwise size={23} className="text-[var(--sauna-accent)]" />
          </div>
          {token ? (
            recentSessions.length ? (
              <div className="mt-4 grid gap-2">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 rounded-[24px] bg-[var(--sauna-soft-strong)] p-3 text-left transition hover:-translate-y-0.5 hover:bg-[var(--sauna-soft)]"
                  >
                    <button type="button" onClick={() => router.push(`/focus-room/${session.id}`)} className="grid size-10 place-items-center rounded-[16px] bg-[var(--sauna-panel-strong)] text-xl shadow-[var(--sauna-shadow)]">
                      {session.agentAvatarEmoji || "🧠"}
                    </button>
                    <div className="min-w-0">
                      {editingSessionId === session.id ? (
                        <form onSubmit={submitRename} className="flex gap-1">
                          <input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            className="min-w-0 flex-1 rounded-full bg-[var(--sauna-panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--sauna-text)] outline-none ring-1 ring-[var(--sauna-line-strong)] focus:ring-[var(--sauna-accent)]"
                            autoFocus
                            maxLength={80}
                          />
                          <button type="submit" className="rounded-full bg-[var(--sauna-primary)] px-2 text-[10px] font-semibold text-[var(--sauna-primary-contrast)]">保存</button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => router.push(`/focus-room/${session.id}`)} className="block w-full text-left">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--sauna-text)]">{session.title || session.agentDisplayName}</span>
                            <span className="shrink-0 text-[11px] text-[var(--sauna-muted)]">{formatSessionTime(session.lastActivityAt, hydrated)}</span>
                          </span>
                        </button>
                      )}
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[var(--sauna-muted)]">
                        {session.lastMessagePreview || `${session.agentDisplayName || "智囊"} 的会话`}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 self-start">
                      <button type="button" onClick={() => beginRename(session)} className="grid size-8 place-items-center rounded-full bg-[var(--sauna-panel-strong)] text-[var(--sauna-muted)] transition hover:text-[var(--sauna-text)]" aria-label="重命名会话">
                        <PencilSimple size={14} />
                      </button>
                      <button type="button" onClick={() => setPendingDeleteSessionId(session.id)} className="grid size-8 place-items-center rounded-full bg-[var(--sauna-panel-strong)] text-[var(--sauna-danger)] transition hover:bg-[var(--sauna-danger-soft)]" aria-label="删除会话">
                        <Trash size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] bg-[var(--sauna-soft-strong)] p-4 text-sm leading-relaxed text-[var(--sauna-muted)]">
                还没有会话。进入任意工位后会自动记录在这里。
              </div>
            )
          ) : (
            <div className="mt-4 rounded-[24px] bg-[var(--sauna-soft-strong)] p-4 text-sm leading-relaxed text-[var(--sauna-muted)]">
              登录后可查看并继续历史会话。
            </div>
          )}
        </div>

        <Link href="/settings" className="group rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] transition hover:-translate-y-1 active:translate-y-px">
          <GearSix size={24} className="text-[var(--sauna-accent)]" />
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.045em] text-[var(--sauna-text)]">模型设置</h2>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--sauna-muted)]">
            接入 provider <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link href="/studio" className="group rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-primary)] p-5 text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)] transition hover:-translate-y-1 active:translate-y-px">
          <FileText size={24} className="text-[var(--sauna-primary-contrast)]" />
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.045em]">创建专家</h2>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--sauna-primary-contrast-muted)]">
            去蒸馏 <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </motion.aside>
    </section>
  );
}
