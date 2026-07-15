"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  X,
} from "@phosphor-icons/react";
import { useSaunaStore } from "@/store/sauna-store";
import { LockedAccessShell } from "@/components/access-coordinator";
import { useAccessUIStore } from "@/store/access-ui-store";
import type { Message } from "@/types/sauna";
import { focusDraftKey, resolveFocusSessionId, shouldReleaseAdoptedFocusSession } from "@/lib/access-policy";

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
      className="relative m-auto grid min-h-[156px] w-full max-w-[380px] place-items-center overflow-hidden rounded-[34px] border border-[color:var(--sauna-inner-line)] bg-[var(--sauna-soft)] px-7 py-8 text-center shadow-[var(--sauna-shadow)]"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="pointer-events-none absolute inset-x-12 top-5 h-px bg-gradient-to-r from-transparent via-[var(--sauna-panel-strong)] to-transparent"
        initial={reduce ? false : { opacity: 0, x: -24 }}
        animate={reduce ? { opacity: 0.45 } : { opacity: 0.72, x: 0 }}
        transition={{ duration: 0.72, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="pointer-events-none absolute -bottom-10 left-1/2 size-28 -translate-x-1/2 rounded-full bg-[var(--sauna-accent-soft)] blur-2xl"
        initial={reduce ? false : { opacity: 0, scale: 0.78 }}
        animate={reduce ? { opacity: 0.42 } : { opacity: 0.62, scale: 1.08 }}
        transition={{ duration: 0.78, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <span
          className="flex items-center gap-1.5 text-[var(--sauna-accent)]"
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
          className="text-balance text-base font-semibold tracking-[-0.025em] text-[var(--sauna-muted-strong)] sm:text-lg"
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
      className="my-4 overflow-hidden rounded-[24px] border border-[color:var(--sauna-accent)] bg-[var(--sauna-panel-strong)] shadow-[var(--sauna-shadow)]"
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative overflow-hidden border-b border-[color:var(--sauna-line)] bg-[var(--sauna-steam)] px-4 py-3">
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[var(--sauna-panel-strong)] to-transparent"
          animate={reduce ? undefined : { x: ["-120%", "520%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--sauna-muted-strong)]">
            <Brain size={17} weight="duotone" className="text-[var(--sauna-accent)]" />
            正在处理
          </span>
          <span className="rounded-full bg-[var(--sauna-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--sauna-accent-strong)]">
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
                  ? "bg-[var(--sauna-accent-soft)] text-[var(--sauna-muted-strong)]"
                  : failed
                    ? "bg-[var(--sauna-danger-soft)] text-[var(--sauna-danger-strong)]"
                    : done
                      ? "bg-[var(--sauna-soft)] text-[var(--sauna-accent-strong)]"
                      : "bg-[var(--sauna-steam)] text-[var(--sauna-muted)]"
              }`}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.28,
                delay: Math.min(index * 0.04, 0.18),
                ease: "easeOut",
              }}
            >
              <span className="grid size-6 place-items-center rounded-full bg-[var(--sauna-panel-strong)]">
                <PlanStatusIcon status={step.status} reduce={reduce} />
              </span>
              <span className="min-w-0 truncate font-medium">{step.step}</span>
              <span className="rounded-full bg-[var(--sauna-panel-strong)] px-2 py-0.5 text-[10px] font-semibold">
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
    <div className="sauna-markdown text-[15px] leading-7 text-[var(--sauna-muted-strong)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0 text-pretty">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 text-2xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)] first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)] first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold tracking-[-0.03em] text-[var(--sauna-text)] first:mt-0">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[var(--sauna-accent)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[var(--sauna-accent)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-[20px] border-l-4 border-[color:var(--sauna-accent)] bg-[var(--sauna-panel-strong)] px-4 py-3 text-[var(--sauna-muted-strong)]">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code className="rounded-md bg-[var(--sauna-panel-strong)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--sauna-accent-strong)]">
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`${className ?? ""} block overflow-x-auto whitespace-pre p-0 font-mono text-[13px] leading-6 text-[var(--sauna-code-text)]`}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-[22px] bg-[var(--sauna-primary)] p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)]">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[color:var(--sauna-line)] px-3 py-2 font-semibold text-[var(--sauna-text)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[color:var(--sauna-line)] px-3 py-2 align-top text-[var(--sauna-muted-strong)]">
              {children}
            </td>
          ),
          a: ({ children, href }) => (
            <a
              className="font-semibold text-[var(--sauna-accent-strong)] underline decoration-[var(--sauna-accent)] underline-offset-4 transition hover:text-[var(--sauna-accent-strong)]"
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
      className={`${isUser ? "ml-auto bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow)]" : "bg-[var(--sauna-soft)] text-[var(--sauna-muted-strong)] shadow-[var(--sauna-shadow)]"} max-w-[78%] rounded-[28px] px-5 py-4`}
      initial={reduce ? false : { opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--sauna-primary-contrast-muted)]">
          {message.content}
        </p>
      ) : isWorking ? (
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--sauna-muted-strong)]">
          <Brain size={18} className="text-[var(--sauna-accent-strong)]" />
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
  retryTurnId,
  onRetry,
  reduce,
}: {
  messages: Message[];
  statusLabel: string;
  busy: boolean;
  focusError?: string;
  archiveStatus: string;
  retryTurnId?: string;
  onRetry?: (turnId: string) => void;
  reduce?: boolean | null;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-4 sm:px-3">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.78)]">
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
                  className="flex w-fit max-w-[78%] items-center gap-3 rounded-[28px] bg-[var(--sauna-soft)] px-5 py-4 text-sm font-medium text-[var(--sauna-muted-strong)] shadow-[var(--sauna-shadow)]"
                  initial={reduce ? false : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Brain size={18} className="text-[var(--sauna-accent-strong)]" />
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
          <div className="mx-4 mb-4 rounded-[24px] bg-[var(--sauna-danger-soft)] px-5 py-4 text-sm leading-relaxed text-[var(--sauna-danger-strong)] sm:mx-6">
            <span className="inline-flex items-center gap-2 font-semibold">
              <WarningCircle size={16} />
              调用失败
            </span>
            <p className="mt-2 whitespace-pre-wrap">{focusError}</p>
            {retryTurnId && onRetry ? <button type="button" onClick={() => onRetry(retryTurnId)} disabled={busy} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--sauna-danger)] px-4 text-sm font-semibold text-white disabled:opacity-50"><ArrowRight size={14} /> {busy ? "正在重新回答" : "重新回答"}</button> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-4 text-xs text-[var(--sauna-muted)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[var(--sauna-accent-strong)]">
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
    adoptedFocusSessionId,
    selectedAgentId,
    sessions,
    messagesBySession,
    streamStatus,
    focusError,
    token,
    providers,
    loadPublicAgents,
    loadIdentity,
    renameFocusSession,
    deleteFocusSession,
    startConsultation,
    resumeSession,
    sendTurn,
    retryTurn,
    consumeInitialPrompt,
    clearAdoptedFocusSession,
  } = useSaunaStore();
  const [draft, setDraft] = useState(initialPrompt);
  const [pendingAutoPrompt, setPendingAutoPrompt] = useState<string>();
  const draftHandoffConsumedRef = useRef(false);
  const autoSendStartedRef = useRef(false);
  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] =
    useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const authIntent = useAccessUIStore((state) => state.auth.intent);
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const openProvider = useAccessUIStore((state) => state.openProvider);
  const hydrated = useHydrated();
  const currentSessionId = resolveFocusSessionId(
    sessionId,
    adoptedFocusSessionId,
  );
  const isDraftSession = currentSessionId === "new";
  const safeMessagesBySession = messagesBySession ?? {};
  const messages = isDraftSession
    ? []
    : (safeMessagesBySession[currentSessionId] ?? []);
  const hasLocalMessages = messages.length > 0;

  useEffect(() => {
    void loadPublicAgents();
    void loadIdentity().catch(() => undefined);
  }, [loadIdentity, loadPublicAgents]);

  useEffect(() => {
    if (!shouldReleaseAdoptedFocusSession(sessionId, adoptedFocusSessionId)) {
      return;
    }

    queueMicrotask(clearAdoptedFocusSession);
  }, [adoptedFocusSessionId, clearAdoptedFocusSession, sessionId]);

  useEffect(() => {
    if (
      draftHandoffConsumedRef.current ||
      sessionId !== "new" ||
      !draftAgentId
    ) {
      return;
    }

    draftHandoffConsumedRef.current = true;
    const queued = consumeInitialPrompt(
      focusDraftKey(draftAgentId),
      initialPrompt,
    );

    if (!queued.content) {
      return;
    }

    queueMicrotask(() => {
      setDraft(queued.content);
      setPendingAutoPrompt(queued.autoSend ? queued.content : undefined);
    });
  }, [consumeInitialPrompt, draftAgentId, initialPrompt, sessionId]);

  useEffect(() => {
    if (isDraftSession) {
      return;
    }
    if (activeSession?.id === currentSessionId && hasLocalMessages) {
      return;
    }
    if (token) {
      void resumeSession(currentSessionId);
    }
  }, [
    activeSession?.id,
    currentSessionId,
    hasLocalMessages,
    isDraftSession,
    resumeSession,
    sessions.length,
    token,
  ]);

  useEffect(() => {
    const restore = (event: Event) => {
      const intent = (event as CustomEvent<typeof authIntent>).detail;
      if (intent.kind === "consultation" && (!draftAgentId || intent.draft.agentId === draftAgentId)) setDraft(intent.draft.content);
    };
    window.addEventListener("sauna-auth-complete", restore);
    return () => window.removeEventListener("sauna-auth-complete", restore);
  }, [draftAgentId]);

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
  const latestFailedAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.status === "failed");
  const latestMessageTurnId = messages.at(-1)?.turn_id;
  const retryTurnId = latestFailedAssistant && latestFailedAssistant.turn_id === latestMessageTurnId ? latestFailedAssistant.turn_id : undefined;
  const visibleFocusError = focusError ?? latestFailedAssistant?.error;
  const statusLabel = assistantStateLabel(
    streamStatus,
    messages,
    currentSessionId,
  );
  const statusTone =
    streamStatus === "error" || visibleFocusError
      ? "text-[var(--sauna-danger-strong)] bg-[var(--sauna-danger-soft)]"
      : busy
        ? "text-[var(--sauna-accent-strong)] bg-[var(--sauna-accent-soft)]"
        : "text-[var(--sauna-accent-strong)] bg-[var(--sauna-panel-strong)]";
  const archiveStatus = visibleFocusError
    ? "本轮未完成，请检查模型配置。"
    : busy
      ? "正在流式接收，完成后自动保存。"
      : messages.length
        ? "对话已记录，可在大厅继续。"
        : "开始提问后，会自动保存会话。";

  const sendContent = useCallback(async (content: string) => {
    const cleanContent = content.trim();
    if (!cleanContent || busy) return;
    if (!token) {
      const agentID = draftAgentId || agent?.id || selectedAgentId;
      openAuth("consultation_guard", { kind: "consultation", draft: { agentId: agentID, content: cleanContent, sourceRoute: window.location.pathname } });
      return;
    }
    if (!providers.length) {
      setDraft(cleanContent);
      openProvider("create", "provider_missing");
      return;
    }
    setDraft("");
    try {
      if (isDraftSession) {
        const agentID = draftAgentId || agent?.id;
        if (!agentID) throw new Error("请选择一个智囊。");
        const nextSession = await startConsultation(agentID, cleanContent);
        window.history.replaceState(null, "", `/focus-room/${nextSession.id}`);
        return;
      }
      await sendTurn(currentSessionId, cleanContent);
    } catch {
      setDraft(cleanContent);
    }
  }, [agent, busy, currentSessionId, draftAgentId, isDraftSession, openAuth, openProvider, providers.length, selectedAgentId, sendTurn, startConsultation, token]);

  useEffect(() => {
    if (
      !pendingAutoPrompt ||
      autoSendStartedRef.current ||
      busy ||
      !token ||
      providers.length === 0 ||
      !isDraftSession
    ) {
      return;
    }

    autoSendStartedRef.current = true;
    void sendContent(pendingAutoPrompt);
  }, [busy, isDraftSession, pendingAutoPrompt, providers.length, sendContent, token]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendContent(draft);
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
      clearAdoptedFocusSession();
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
    clearAdoptedFocusSession();
    router.push(`/focus-room/new?agentId=${encodeURIComponent(agentID)}`);
  }

  if (!token) {
    return <LockedAccessShell title="这是一间私人咨询室" copy="登录后才能进入会话、读取历史和调用你的模型。当前页面不会在访客状态请求任何私人消息。" />;
  }

  return (
    <section className="relative flex h-[calc(100dvh-7rem)] min-h-0 overflow-hidden rounded-[36px] border border-[color:var(--sauna-line)] bg-[color-mix(in_srgb,var(--sauna-panel-strong)_94%,transparent)] shadow-[var(--sauna-shadow)] backdrop-blur-xl">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-5"
      >
        <div className="relative flex items-center justify-between gap-3 rounded-[25px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => router.push("/lobby")} className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--sauna-primary)] text-xl text-[var(--sauna-primary-contrast)]" aria-label="返回桑拿房">
              {agent?.avatarSeed ?? "🧠"}
            </button>
            <div className="min-w-0">
              <h1 className="sauna-display truncate text-xl tracking-[-0.035em] text-[var(--sauna-text)] sm:text-2xl">{title}</h1>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--sauna-muted)]"><span>{agent?.role ?? "专注咨询"}</span><span>·</span><span>{statusLabel}</span>{busy ? <ThinkingDots reduce={reduce} /> : null}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void openFreshSession()} disabled={!token || busy} className="hidden h-10 items-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-4 text-sm font-semibold text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft)] disabled:opacity-40 sm:inline-flex">新咨询 <ArrowRight size={14} /></button>
            <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--sauna-soft)] px-4 text-sm font-semibold text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft-strong)]"><ClockCounterClockwise size={16} /><span className="hidden sm:inline">历史记录</span></button>
          </div>
        </div>

        <ChatMessagesPanel messages={messages} statusLabel={statusLabel} busy={busy} focusError={visibleFocusError} archiveStatus={archiveStatus} retryTurnId={retryTurnId} onRetry={(turnId) => void retryTurn(currentSessionId, turnId)} reduce={reduce} />

        <form onSubmit={submitMessage} className="relative flex items-end gap-3 rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] p-2.5 transition focus-within:border-[var(--sauna-accent)] focus-within:bg-[var(--sauna-panel-strong)]">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} className="max-h-36 min-h-7 min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[var(--sauna-text)] outline-none placeholder:text-[var(--sauna-muted)]" placeholder={token ? (busy ? "智囊正在工作" : "说出你真正想解决的问题…") : "请先在大厅登录"} disabled={!token || busy} />
          <button type="submit" disabled={!token || busy || !draft.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={busy ? "正在发送" : "发送"}><SubmitGlyph busy={busy} reduce={reduce} /></button>
        </form>
      </motion.div>

      <AnimatePresence>
      {historyOpen ? (
        <motion.div className="fixed inset-0 z-50 bg-[var(--sauna-scrim)] backdrop-blur-sm" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setHistoryOpen(false)}>
          <motion.aside role="dialog" aria-modal="true" aria-label="历史咨询" initial={reduce ? false : { x: "100%", filter: "blur(6px)" }} animate={{ x: 0, filter: "blur(0px)" }} exit={{ x: "100%", filter: "blur(4px)" }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} onMouseDown={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)]">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm text-[var(--sauna-muted)]">Consultation archive</p><h2 className="sauna-display mt-1 text-3xl tracking-[-0.04em]">历史咨询</h2></div><button type="button" onClick={() => setHistoryOpen(false)} className="grid size-10 place-items-center rounded-full bg-[var(--sauna-soft)] text-[var(--sauna-muted)]" aria-label="关闭历史记录"><X size={17} /></button></div>
            <div className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {historySessions.length ? historySessions.map((session) => {
                const active = session.id === currentSessionId;
                return (
                  <div key={session.id} className={`grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 rounded-[20px] border p-3 ${active ? "border-[color:var(--sauna-accent)] bg-[var(--sauna-accent-soft)]" : "border-[color:var(--sauna-line)] bg-[var(--sauna-panel)]"}`}>
                    <button type="button" onClick={() => { setHistoryOpen(false); clearAdoptedFocusSession(); router.push(`/focus-room/${session.id}`); }} className="grid size-10 place-items-center rounded-[15px] bg-[var(--sauna-panel-strong)] text-xl">{session.agentAvatarEmoji || "🧠"}</button>
                    <div className="min-w-0">
                      {editingSessionId === session.id ? (
                        <form onSubmit={submitRename} className="flex gap-1"><input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="min-w-0 flex-1 rounded-full bg-[var(--sauna-panel-strong)] px-3 py-1 text-xs outline-none ring-1 ring-[var(--sauna-line-strong)]" autoFocus maxLength={80} /><button type="submit" className="rounded-full bg-[var(--sauna-primary)] px-2 text-[10px] text-[var(--sauna-primary-contrast)]">保存</button></form>
                      ) : (
                        <button type="button" onClick={() => { setHistoryOpen(false); clearAdoptedFocusSession(); router.push(`/focus-room/${session.id}`); }} className="block w-full text-left"><span className="block truncate text-sm font-semibold text-[var(--sauna-text)]">{session.title || session.agentDisplayName}</span><span className="mt-1 block truncate text-xs text-[var(--sauna-muted)]">{formatSessionTime(session.lastActivityAt, hydrated)}</span></button>
                      )}
                    </div>
                    <span className="flex items-start gap-1"><button type="button" onClick={() => beginRename(session)} className="grid size-8 place-items-center rounded-full text-[var(--sauna-muted)] hover:bg-[var(--sauna-soft)]" aria-label="重命名会话"><PencilSimple size={14} /></button><button type="button" onClick={() => setPendingDeleteSessionId(session.id)} className="grid size-8 place-items-center rounded-full text-[var(--sauna-danger)] hover:bg-[var(--sauna-danger-soft)]" aria-label="删除会话"><Trash size={14} /></button></span>
                  </div>
                );
              }) : <div className="rounded-[22px] bg-[var(--sauna-soft)] p-5 text-sm text-[var(--sauna-muted)]">还没有真正发生过的咨询。</div>}
            </div>
            <button type="button" onClick={() => { setHistoryOpen(false); void openFreshSession(); }} disabled={!token || busy} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] text-sm font-semibold text-[var(--sauna-primary-contrast)] disabled:opacity-40">新开咨询 <ArrowRight size={15} /></button>
          </motion.aside>
        </motion.div>
      ) : null}
      </AnimatePresence>

      <AnimatePresence>
      {pendingDeleteSessionId ? (
        <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-[var(--sauna-scrim)] px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="删除会话确认">
          <motion.div initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm rounded-[28px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)]">
            <h2 className="sauna-display text-2xl tracking-[-0.04em]">删除这条咨询？</h2><p className="mt-3 text-sm leading-6 text-[var(--sauna-muted)]">消息和事件记录会一并清理，无法恢复。</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setPendingDeleteSessionId(undefined)} className="h-10 rounded-full bg-[var(--sauna-soft)] px-4 text-sm font-semibold text-[var(--sauna-muted-strong)]">取消</button><button type="button" onClick={() => void confirmDeleteSession()} className="h-10 rounded-full bg-[var(--sauna-danger)] px-4 text-sm font-semibold text-white">删除</button></div>
          </motion.div>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </section>
  );
}
