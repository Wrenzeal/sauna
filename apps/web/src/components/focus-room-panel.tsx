"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Brain,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  DotsThree,
  PencilSimple,
  Trash,
  PaperPlaneRight,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useSaunaStore } from "@/store/sauna-store";
import type { Message } from "@/types/sauna";

const subscribeHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
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
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function assistantStateLabel(
  streamStatus: string,
  messages: Message[],
  sessionId: string,
) {
  if (streamStatus === "loading") {
    return "正在连接智囊";
  }
  if (streamStatus === "error") {
    return "调用失败";
  }
  const latestAssistant = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" && message.session_id === sessionId,
    );
  if (streamStatus === "streaming") {
    return latestAssistant?.content?.trim() ? "正在输出" : "正在思考";
  }
  if (latestAssistant?.status === "failed") {
    return "调用失败";
  }
  if (
    latestAssistant?.status === "partial" ||
    latestAssistant?.status === "pending"
  ) {
    return latestAssistant.content?.trim() ? "正在输出" : "正在思考";
  }
  return latestAssistant ? "已完成" : "ready";
}

function ThinkingDots({ reduce = false }: { reduce?: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-current"
          animate={
            reduce ? undefined : { opacity: [0.28, 1, 0.28], y: [0, -3, 0] }
          }
          transition={{
            duration: 0.95,
            repeat: Infinity,
            delay: index * 0.14,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

const emptyPrompts = [
  "来都来了，别不说话呀~",
  "客官这么害羞，来嘛~~",
  "BOSS，今天有何指教？",
  "桑拿都一起蒸了，还不说话吗！",
  "是谁在召唤我！",
  "别让智囊团干坐着呀~",
  "今天想先拆哪个问题？",
];

function pickEmptyPrompt() {
  return (
    emptyPrompts[Math.floor(Math.random() * emptyPrompts.length)] ??
    emptyPrompts[0]
  );
}

function RandomEmptyPrompt({ reduce = false }: { reduce?: boolean | null }) {
  const hydrated = useHydrated();
  const [prompt] = useState(pickEmptyPrompt);
  const visiblePrompt = hydrated ? prompt : emptyPrompts[0];

  return (
    <motion.div
      className="relative m-auto grid min-h-[156px] w-full max-w-[380px] place-items-center overflow-hidden rounded-[34px] border border-white/72 bg-[#eef0eb] px-7 py-8 text-center shadow-[0_22px_70px_rgb(92_117_89_/_0.12)]"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="pointer-events-none absolute inset-x-12 top-5 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
        initial={reduce ? false : { opacity: 0, x: -24 }}
        animate={reduce ? { opacity: 0.45 } : { opacity: 0.72, x: 0 }}
        transition={{ duration: 0.72, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="pointer-events-none absolute -bottom-10 left-1/2 size-28 -translate-x-1/2 rounded-full bg-[#dfeadc] blur-2xl"
        initial={reduce ? false : { opacity: 0, scale: 0.78 }}
        animate={reduce ? { opacity: 0.42 } : { opacity: 0.62, scale: 1.08 }}
        transition={{ duration: 0.78, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <span
          className="flex items-center gap-1.5 text-[#6f8f72]"
          aria-hidden="true"
        >
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="size-1.5 rounded-full bg-current"
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={
                reduce
                  ? { opacity: 0.72 }
                  : { opacity: [0.35, 1, 0.55], scale: [0.82, 1.2, 1] }
              }
              transition={{
                duration: 0.95,
                delay: 0.18 + dot * 0.12,
                ease: "easeOut",
              }}
            />
          ))}
        </span>
        <motion.p
          className="text-balance text-base font-semibold tracking-[-0.025em] text-[#3f4b42] sm:text-lg"
          initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={
            reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{ duration: 0.42, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {visiblePrompt}
        </motion.p>
      </div>
    </motion.div>
  );
}

type PlanStep = {
  step: string;
  status: "pending" | "in_progress" | "completed" | "failed" | string;
};

type MessageSegment =
  | { kind: "markdown"; content: string }
  | { kind: "plan"; steps: PlanStep[] }
  | { kind: "pending-plan" };

function isInsideFence(content: string, index: number) {
  const before = content.slice(0, index);
  const matches = before.match(/```/g);
  return Boolean(matches && matches.length % 2 === 1);
}

function findBalancedJSONEnd(content: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
      if (depth < 0) {
        return null;
      }
    }
  }
  return null;
}

function normalizePlanPayload(value: unknown): PlanStep[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const plan = (value as { plan?: unknown }).plan;
  if (!Array.isArray(plan) || plan.length === 0) {
    return null;
  }
  const steps = plan.map((item) => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const step = (item as { step?: unknown }).step;
    const status = (item as { status?: unknown }).status;
    if (typeof step !== "string" || !step.trim()) {
      return null;
    }
    return {
      step: step.trim(),
      status:
        typeof status === "string" && status.trim() ? status.trim() : "pending",
    };
  });
  if (steps.some((step) => step === null)) {
    return null;
  }
  return steps as PlanStep[];
}

function findNextPlanObjectStart(content: string, from: number) {
  const match = /{\s*"plan"\s*:/.exec(content.slice(from));
  return match ? from + match.index : -1;
}

function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const start = findNextPlanObjectStart(content, searchFrom);
    if (start === -1) {
      break;
    }
    if (isInsideFence(content, start)) {
      searchFrom = start + 1;
      continue;
    }
    const end = findBalancedJSONEnd(content, start);
    if (!end) {
      const before = content.slice(cursor, start).trim();
      if (before) {
        segments.push({ kind: "markdown", content: before });
      }
      segments.push({ kind: "pending-plan" });
      cursor = content.length;
      break;
    }
    const raw = content.slice(start, end);
    try {
      const steps = normalizePlanPayload(JSON.parse(raw));
      if (!steps) {
        searchFrom = start + 1;
        continue;
      }
      const before = content.slice(cursor, start).trim();
      if (before) {
        segments.push({ kind: "markdown", content: before });
      }
      segments.push({ kind: "plan", steps });
      cursor = end;
      searchFrom = end;
    } catch {
      searchFrom = start + 1;
    }
  }

  const after = content.slice(cursor).trim();
  if (after) {
    segments.push({ kind: "markdown", content: after });
  }
  return segments.length ? segments : [{ kind: "markdown", content }];
}

function statusCopy(status: string) {
  switch (status) {
    case "in_progress":
      return "进行中";
    case "completed":
      return "完成";
    case "failed":
      return "失败";
    case "pending":
    default:
      return "等待";
  }
}

function PlanStatusIcon({
  status,
  reduce,
}: {
  status: string;
  reduce?: boolean | null;
}) {
  if (status === "completed") {
    return <CheckCircle size={15} weight="fill" />;
  }
  if (status === "failed") {
    return <WarningCircle size={15} weight="fill" />;
  }
  if (status === "in_progress") {
    return (
      <motion.span
        className="grid size-4 place-items-center rounded-full border border-current"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      >
        <span className="size-1.5 rounded-full bg-current" />
      </motion.span>
    );
  }
  return <span className="size-2 rounded-full bg-current opacity-50" />;
}

function PlanProgressCard({
  steps,
  reduce,
}: {
  steps: PlanStep[];
  reduce?: boolean | null;
}) {
  const activeCount = steps.filter(
    (step) => step.status === "completed",
  ).length;
  return (
    <motion.div
      className="my-4 overflow-hidden rounded-[24px] border border-[#9dbf9b]/45 bg-white/78 shadow-[0_16px_42px_rgb(92_117_89_/_0.12)]"
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative overflow-hidden border-b border-black/[0.06] bg-[#f7f8f5] px-4 py-3">
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/80 to-transparent"
          animate={reduce ? undefined : { x: ["-120%", "520%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#3f4b42]">
            <Brain size={17} weight="duotone" className="text-[#6f8f72]" />
            正在处理
          </span>
          <span className="rounded-full bg-[#dfeadc] px-2.5 py-1 text-[11px] font-semibold text-[#44664d]">
            {activeCount}/{steps.length}
          </span>
        </div>
      </div>
      <ol className="grid gap-2 p-3">
        {steps.map((step, index) => {
          const active = step.status === "in_progress";
          const failed = step.status === "failed";
          const done = step.status === "completed";
          return (
            <motion.li
              key={`${step.step}-${index}`}
              className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 py-2.5 text-sm ${
                active
                  ? "bg-[#dfeadc] text-[#3f4b42]"
                  : failed
                    ? "bg-[#eadfc8] text-[#765f34]"
                    : done
                      ? "bg-[#eef0eb] text-[#44664d]"
                      : "bg-[#f7f8f5] text-[#68707d]"
              }`}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.28,
                delay: Math.min(index * 0.04, 0.18),
                ease: "easeOut",
              }}
            >
              <span className="grid size-6 place-items-center rounded-full bg-white/72">
                <PlanStatusIcon status={step.status} reduce={reduce} />
              </span>
              <span className="min-w-0 truncate font-medium">{step.step}</span>
              <span className="rounded-full bg-white/58 px-2 py-0.5 text-[10px] font-semibold">
                {statusCopy(step.status)}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </motion.div>
  );
}

function RichAssistantMessage({
  content,
  reduce,
}: {
  content: string;
  reduce?: boolean | null;
}) {
  return (
    <>
      {parseMessageSegments(content).map((segment, index) => {
        if (segment.kind === "pending-plan") {
          return (
            <PlanProgressCard
              key={`pending-plan-${index}`}
              steps={[{ step: "正在拆解任务", status: "in_progress" }]}
              reduce={reduce}
            />
          );
        }
        if (segment.kind === "plan") {
          return (
            <PlanProgressCard
              key={`plan-${index}`}
              steps={segment.steps}
              reduce={reduce}
            />
          );
        }
        return (
          <MarkdownMessage
            key={`markdown-${index}`}
            content={segment.content}
          />
        );
      })}
    </>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="sauna-markdown text-[15px] leading-7 text-[#2f343a]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0 text-pretty">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 text-2xl font-semibold tracking-[-0.05em] text-[#171a1f] first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 text-xl font-semibold tracking-[-0.04em] text-[#171a1f] first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold tracking-[-0.03em] text-[#171a1f] first:mt-0">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[#6f8f72]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[#6f8f72]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-[20px] border-l-4 border-[#9dbf9b] bg-white/58 px-4 py-3 text-[#4e5660]">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code className="rounded-md bg-white/78 px-1.5 py-0.5 font-mono text-[0.92em] text-[#44664d]">
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`${className ?? ""} block overflow-x-auto whitespace-pre p-0 font-mono text-[13px] leading-6 text-[#eef0eb]`}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-[22px] bg-[#171a1f] p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-[18px] border border-black/[0.08] bg-white/70">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-black/[0.08] px-3 py-2 font-semibold text-[#171a1f]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-black/[0.06] px-3 py-2 align-top text-[#4e5660]">
              {children}
            </td>
          ),
          a: ({ children, href }) => (
            <a
              className="font-semibold text-[#44664d] underline decoration-[#9dbf9b] underline-offset-4 transition hover:text-[#2f5539]"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({
  message,
  reduce,
}: {
  message: Message;
  reduce?: boolean | null;
}) {
  const isUser = message.role === "user";
  const isWorking =
    message.role === "assistant" &&
    (message.status === "pending" || message.status === "partial") &&
    !message.content.trim();
  return (
    <motion.article
      className={`${isUser ? "ml-auto bg-[#171a1f] text-white shadow-[0_16px_40px_rgb(23_26_31_/_0.16)]" : "bg-[#eef0eb] text-[#2f343a] shadow-[0_14px_38px_rgb(92_117_89_/_0.10)]"} max-w-[78%] rounded-[28px] px-5 py-4`}
      initial={reduce ? false : { opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap text-sm leading-7 text-white/92">
          {message.content}
        </p>
      ) : isWorking ? (
        <div className="flex items-center gap-3 text-sm font-medium text-[#4e5660]">
          <Brain size={18} className="text-[#44664d]" />
          正在组织答案 <ThinkingDots reduce={reduce} />
        </div>
      ) : (
        <RichAssistantMessage
          content={message.content || "正在组织答案..."}
          reduce={reduce}
        />
      )}
    </motion.article>
  );
}

function SubmitGlyph({
  busy,
  reduce,
}: {
  busy: boolean;
  reduce?: boolean | null;
}) {
  if (!busy) {
    return <PaperPlaneRight size={18} weight="fill" />;
  }
  return (
    <motion.span
      className="grid place-items-center"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
    >
      <CircleNotch size={20} weight="bold" />
    </motion.span>
  );
}

function ChatMessagesPanel({
  messages,
  statusLabel,
  busy,
  focusError,
  archiveStatus,
  reduce,
}: {
  messages: Message[];
  statusLabel: string;
  busy: boolean;
  focusError?: string;
  archiveStatus: string;
  reduce?: boolean | null;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-4 sm:px-3">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border border-black/[0.06] bg-[#fbfbf8] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.78)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {messages.length ? (
            <div className="flex min-h-full flex-col justify-end gap-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  reduce={reduce}
                />
              ))}
              {busy &&
              !messages.some(
                (message) =>
                  message.role === "assistant" &&
                  (message.status === "pending" ||
                    message.status === "partial"),
              ) ? (
                <motion.div
                  className="flex w-fit max-w-[78%] items-center gap-3 rounded-[28px] bg-[#eef0eb] px-5 py-4 text-sm font-medium text-[#4e5660] shadow-[0_14px_38px_rgb(92_117_89_/_0.10)]"
                  initial={reduce ? false : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Brain size={18} className="text-[#44664d]" />
                  {statusLabel} <ThinkingDots reduce={reduce} />
                </motion.div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <RandomEmptyPrompt reduce={reduce} />
            </div>
          )}
        </div>

        {focusError ? (
          <div className="mx-4 mb-4 rounded-[24px] bg-[#eadfc8] px-5 py-4 text-sm leading-relaxed text-[#765f34] sm:mx-6">
            <span className="inline-flex items-center gap-2 font-semibold">
              <WarningCircle size={16} />
              调用失败
            </span>
            <p className="mt-2 whitespace-pre-wrap">{focusError}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-[24px] border border-[#3a2416]/[0.08] bg-[#fbfbf8] p-4 text-xs text-[#68707d]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[#44664d]">
            <CheckCircle size={15} weight="fill" />
            会话记录
          </span>
          <span>{archiveStatus}</span>
        </div>
      </div>
    </div>
  );
}

export function FocusRoomPanel({
  sessionId,
  initialPrompt = "",
  draftAgentId = "",
}: {
  sessionId: string;
  initialPrompt?: string;
  draftAgentId?: string;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const {
    agents,
    activeSession,
    selectedAgentId,
    sessions,
    messagesBySession,
    streamStatus,
    focusError,
    token,
    loadPublicAgents,
    loadIdentity,
    loadMessages,
    renameFocusSession,
    deleteFocusSession,
    startConsultation,
    resumeSession,
    sendTurn,
  } = useSaunaStore();
  const [sessionView, setSessionView] = useState(() => ({
    routeSessionId: sessionId,
    currentSessionId: sessionId,
  }));
  const [draft, setDraft] = useState(initialPrompt);
  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] =
    useState<string>();
  const hydrated = useHydrated();
  if (sessionView.routeSessionId !== sessionId) {
    setSessionView({ routeSessionId: sessionId, currentSessionId: sessionId });
  }
  const currentSessionId =
    sessionView.routeSessionId === sessionId
      ? sessionView.currentSessionId
      : sessionId;
  const isDraftSession = currentSessionId === "new";
  const safeMessagesBySession = messagesBySession ?? {};
  const messages = isDraftSession
    ? []
    : (safeMessagesBySession[currentSessionId] ?? []);
  const hasLocalMessages = messages.length > 0;

  useEffect(() => {
    void loadPublicAgents();
    void loadIdentity();
  }, [loadIdentity, loadPublicAgents]);

  useEffect(() => {
    if (isDraftSession) {
      return;
    }
    if (activeSession?.id === currentSessionId && hasLocalMessages) {
      return;
    }
    if (token) {
      void resumeSession(currentSessionId);
      return;
    }
    void loadMessages(currentSessionId);
  }, [
    activeSession?.id,
    currentSessionId,
    hasLocalMessages,
    isDraftSession,
    loadMessages,
    resumeSession,
    sessions.length,
    token,
  ]);

  const agent = useMemo(() => {
    const agentList = agents ?? [];
    const activeAgentID = isDraftSession
      ? draftAgentId || selectedAgentId
      : activeSession?.id === currentSessionId
        ? activeSession.agent_id
        : selectedAgentId;
    return agentList.find((item) => item.id === activeAgentID) ?? agentList[0];
  }, [
    activeSession,
    agents,
    currentSessionId,
    draftAgentId,
    isDraftSession,
    selectedAgentId,
  ]);

  const safeSessions = sessions ?? [];
  const historySessions = safeSessions.slice(0, 8);
  const title = isDraftSession
    ? `${agent?.displayName ?? "智囊"} 的 VIP 桑拿房`
    : activeSession?.id === currentSessionId
      ? activeSession.title
      : "VIP 桑拿房";
  const busy = streamStatus === "loading" || streamStatus === "streaming";
  const statusLabel = assistantStateLabel(
    streamStatus,
    messages,
    currentSessionId,
  );
  const statusTone =
    streamStatus === "error" || focusError
      ? "text-[#765f34] bg-[#eadfc8]"
      : busy
        ? "text-[#44664d] bg-[#dfeadc]"
        : "text-[#44664d] bg-white";
  const archiveStatus = focusError
    ? "本轮未完成，请检查模型配置。"
    : busy
      ? "正在流式接收，完成后自动保存。"
      : messages.length
        ? "对话已记录，可在大厅继续。"
        : "开始提问后，会自动保存会话。";

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) {
      return;
    }
    setDraft("");
    try {
      if (isDraftSession) {
        const agentID = draftAgentId || agent?.id;
        if (!agentID) {
          throw new Error("请选择一个智囊。");
        }
        const nextSession = await startConsultation(agentID, content);
        setSessionView({
          routeSessionId: sessionId,
          currentSessionId: nextSession.id,
        });
        window.history.replaceState(null, "", `/focus-room/${nextSession.id}`);
        return;
      }
      await sendTurn(currentSessionId, content);
    } catch {
      setDraft(content);
    }
  }

  function beginRename(session: {
    id: string;
    title: string;
    agentDisplayName?: string;
  }) {
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
    const targetSessionId = pendingDeleteSessionId;
    setPendingDeleteSessionId(undefined);
    await deleteFocusSession(targetSessionId);
    if (targetSessionId === currentSessionId) {
      setSessionView({ routeSessionId: "new", currentSessionId: "new" });
      router.replace("/focus-room/new");
    }
  }

  async function openFreshSession() {
    const agentID =
      activeSession?.id === currentSessionId
        ? activeSession.agent_id
        : agent?.id;
    if (!agentID) {
      return;
    }
    setSessionView({ routeSessionId: "new", currentSessionId: "new" });
    router.push(`/focus-room/new?agentId=${encodeURIComponent(agentID)}`);
  }

  return (
    <section className="grid h-[calc(100dvh-7rem)] min-h-0 gap-5 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
      <motion.aside
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-0 overflow-y-auto overscroll-contain rounded-[38px] border border-black/[0.08] bg-[#fbfbf8]/86 p-5 shadow-[0_26px_90px_rgb(28_34_24_/_0.10)] backdrop-blur-xl"
      >
        <p className="text-sm font-medium text-[#68707d]">VIP 桑拿房</p>
        <motion.div
          className="mt-7 grid size-24 place-items-center rounded-[30px] bg-[#dfeadc] text-4xl text-[#44664d]"
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {agent?.avatarSeed ?? "🧠"}
        </motion.div>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-[#171a1f]">
          {agent?.displayName ?? "智囊"}
        </h1>
        <p className="mt-2 text-[#68707d]">{agent?.role ?? "专注咨询"}</p>

        <div className="mt-8 grid gap-3">
          <div className="flex items-center gap-3 rounded-[24px] bg-[#eef0eb] p-4 text-sm text-[#4e5660]">
            <ShieldCheck size={20} className="text-[#44664d]" />
            {token ? "已登录" : "需要登录"}
          </div>
          <div className="flex items-center gap-3 rounded-[24px] bg-[#171a1f] p-4 text-sm text-white/76">
            <Brain size={20} className="text-[#dfeadc]" />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {statusLabel}
              {busy ? <ThinkingDots reduce={reduce} /> : null}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] bg-white/74 p-3 shadow-[0_16px_44px_rgb(28_34_24_/_0.07)]">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <h2 className="text-sm font-semibold text-[#171a1f]">历史咨询</h2>
            <ClockCounterClockwise size={17} className="text-[#6f8f72]" />
          </div>
          {historySessions.length ? (
            <div className="mt-2 grid max-h-[330px] gap-2 overflow-y-auto pr-1">
              {historySessions.map((session) => {
                const active = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    className={`grid grid-cols-[34px_minmax(0,1fr)_auto] gap-2 rounded-[20px] p-2 transition ${active ? "bg-[#dfeadc]" : "bg-[#f4f5f2] hover:bg-[#eef0eb]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/focus-room/${session.id}`)}
                      className="grid size-8 place-items-center rounded-[13px] bg-white text-lg"
                    >
                      {session.agentAvatarEmoji || "🧠"}
                    </button>
                    <div className="min-w-0">
                      {editingSessionId === session.id ? (
                        <form
                          onSubmit={submitRename}
                          onClick={(event) => event.stopPropagation()}
                          className="flex gap-1"
                        >
                          <input
                            value={editingTitle}
                            onChange={(event) =>
                              setEditingTitle(event.target.value)
                            }
                            className="min-w-0 flex-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#171a1f] outline-none ring-1 ring-black/[0.08] focus:ring-[#9dbf9b]"
                            autoFocus
                            maxLength={80}
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-[#171a1f] px-2 text-[10px] font-semibold text-white"
                          >
                            保存
                          </button>
                        </form>
                      ) : (
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-[#171a1f]">
                            {session.title || session.agentDisplayName}
                          </span>
                          <span className="shrink-0 text-[10px] text-[#87909a]">
                            {formatSessionTime(
                              session.lastActivityAt,
                              hydrated,
                            )}
                          </span>
                        </span>
                      )}
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-[#68707d]">
                        {session.lastMessagePreview ||
                          `${session.agentDisplayName || "智囊"} 的会话`}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 self-start">
                      <button
                        type="button"
                        onClick={() => beginRename(session)}
                        className="grid size-7 place-items-center rounded-full bg-white text-[#68707d] transition hover:text-[#171a1f]"
                        aria-label="重命名会话"
                      >
                        <PencilSimple size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteSessionId(session.id)}
                        className="grid size-7 place-items-center rounded-full bg-white text-[#9a4f4f] transition hover:bg-[#eadfc8]"
                        aria-label="删除会话"
                      >
                        <Trash size={13} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 rounded-[20px] bg-[#f4f5f2] p-3 text-xs leading-relaxed text-[#68707d]">
              会话会自动保存在这里。
            </p>
          )}
          <button
            type="button"
            onClick={() => void openFreshSession()}
            disabled={!token || busy}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#6f8f72] text-sm font-semibold text-white transition hover:bg-[#5d805f] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#b7bbb4]"
          >
            新开咨询 <ArrowRight size={15} />
          </button>
        </div>
      </motion.aside>

      {pendingDeleteSessionId ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#171a1f]/28 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="删除会话确认"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm rounded-[30px] bg-white p-6 shadow-[0_30px_90px_rgb(23_26_31_/_0.20)]"
          >
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#171a1f]">
              删除这条咨询？
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#68707d]">
              删除后会清理这条会话的消息和事件记录，无法恢复。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteSessionId(undefined)}
                className="h-10 rounded-full bg-[#f4f5f2] px-4 text-sm font-semibold text-[#4e5660] transition hover:bg-[#eef0eb]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSession()}
                className="h-10 rounded-full bg-[#9a4f4f] px-4 text-sm font-semibold text-white transition hover:bg-[#844444]"
              >
                删除
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-0 flex-col overflow-hidden rounded-[38px] border border-black/[0.08] bg-white/88 p-4 shadow-[0_26px_90px_rgb(28_34_24_/_0.10)] backdrop-blur-xl sm:p-5"
      >
        <div className="relative flex items-center justify-between gap-4 rounded-[30px] bg-[#f4f5f2] p-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[#171a1f]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[#68707d]">1v1 咨询</p>
          </div>
          <span
            className={`hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${statusTone}`}
          >
            {busy ? (
              <DotsThree size={16} weight="bold" />
            ) : (
              <CheckCircle size={14} weight="fill" />
            )}
            {statusLabel}
          </span>
        </div>

        <ChatMessagesPanel
          messages={messages}
          statusLabel={statusLabel}
          busy={busy}
          focusError={focusError}
          archiveStatus={archiveStatus}
          reduce={reduce}
        />

        <form
          onSubmit={submitMessage}
          className="relative flex items-center gap-3 rounded-full border border-black/[0.08] bg-[#f7f8f5] p-2 transition focus-within:border-[#9dbf9b] focus-within:bg-white"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-4 text-sm text-[#171a1f] outline-none placeholder:text-[#87909a]"
            placeholder={
              token ? (busy ? "智囊正在工作" : "输入问题") : "请先在大厅登录"
            }
            disabled={!token || busy}
          />
          <button
            type="submit"
            disabled={!token || busy || !draft.trim()}
            className="grid size-11 place-items-center rounded-full bg-[#6f8f72] text-white transition hover:bg-[#5d805f] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#b7bbb4]"
            aria-label={busy ? "正在发送" : "发送"}
          >
            <SubmitGlyph busy={busy} reduce={reduce} />
          </button>
        </form>
      </motion.div>
    </section>
  );
}
