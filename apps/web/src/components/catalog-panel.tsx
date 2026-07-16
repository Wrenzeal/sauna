"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, MagnifyingGlass, Plus, Sparkle, UserPlus, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createSaunaApiClient, humanizeApiError, SaunaApiError } from "@/lib/sauna-api";
import { saunaEase } from "@/lib/motion-system";
import { useAccessUIStore } from "@/store/access-ui-store";
import { useSaunaStore } from "@/store/sauna-store";
import type { CatalogEntry, CatalogRequest } from "@/types/sauna";

const requestStatus: Record<string, string> = {
  submitted: "已提交", reviewing: "正在评估", approved: "已排期", distilling: "正在蒸馏", fulfilled: "已上架", rejected: "暂不处理",
};

export function CatalogPanel() {
  const reduce = useReducedMotion();
  const token = useSaunaStore((state) => state.token);
  const loadWorkspaceAgents = useSaunaStore((state) => state.loadWorkspaceAgents);
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const [items, setItems] = useState<CatalogEntry[]>([]);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true); setError("");
    try {
      const api = createSaunaApiClient(token);
      const [catalogResult, requestsResult] = await Promise.allSettled([
        api.listCatalog(),
        token ? api.listMyCatalogRequests() : Promise.resolve({ items: [] as CatalogRequest[] }),
      ]);
      if (catalogResult.status === "rejected") throw catalogResult.reason;
      setItems(catalogResult.value.items ?? []);
      if (requestsResult.status === "fulfilled") {
        setRequests(requestsResult.value.items ?? []);
      } else {
        setError("人物列表已加载，但申请记录暂时不可用。");
      }
    } catch (cause) { setError(humanizeApiError(cause)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    let active = true;
    const api = createSaunaApiClient(token);
    void Promise.allSettled([
      api.listCatalog(),
      token ? api.listMyCatalogRequests() : Promise.resolve({ items: [] as CatalogRequest[] }),
    ]).then(([catalogResult, requestsResult]) => {
      if (!active) return;
      if (catalogResult.status === "rejected") throw catalogResult.reason;
      setItems(catalogResult.value.items ?? []);
      if (requestsResult.status === "fulfilled") {
        setRequests(requestsResult.value.items ?? []);
      } else {
        setError("人物列表已加载，但申请记录暂时不可用。");
      }
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setError(humanizeApiError(cause));
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(items.flatMap((item) => item.categories ?? [])))], [items]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => (category === "全部" || item.categories.includes(category)) && (!needle || `${item.agent.display_name} ${item.summary} ${item.tags.join(" ")}`.toLowerCase().includes(needle)));
  }, [category, items, query]);

  async function toggleInstall(item: CatalogEntry) {
    if (!token) { openAuth("protected_action", { kind: "route", returnTo: "/catalog" }); return; }
    setBusyId(item.agent.id); setError("");
    try {
      const api = createSaunaApiClient(token);
      if (item.installed) await api.removeCatalogAgent(item.agent.id); else await api.installCatalogAgent(item.agent.id);
      setItems((current) => current.map((entry) => entry.agent.id === item.agent.id ? { ...entry, installed: !item.installed } : entry));
      await loadWorkspaceAgents(token);
    } catch (cause) { setError(humanizeApiError(cause)); }
    finally { setBusyId(""); }
  }

  return (
    <section className="pb-10">
      <div className="relative overflow-hidden rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-6 py-8 shadow-[var(--sauna-shadow)] sm:px-9 lg:px-12 lg:py-11">
        <motion.div aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full bg-[var(--sauna-accent-soft)] opacity-60 blur-3xl" animate={reduce ? undefined : { x: [0, -12, 0], y: [0, 8, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-[var(--sauna-accent-strong)]">人物大厅</p>
          <h1 className="sauna-display mt-3 text-4xl tracking-[-0.055em] text-[var(--sauna-text)] sm:text-5xl">先从已经蒸馏好的人开始。</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--sauna-muted-strong)] sm:text-base">每位人物都由平台整理资料、蒸馏并审核。添加到智囊团后，新的咨询会自动使用其最新公开版本。</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-5 focus-within:border-[var(--sauna-accent)]">
              <MagnifyingGlass size={18} className="text-[var(--sauna-muted)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sauna-text)] outline-none" placeholder="搜索人物、领域或思想方法" />
            </label>
            <button onClick={() => token ? setRequestOpen(true) : openAuth("protected_action", { kind: "route", returnTo: "/catalog" })} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)]">
              <UserPlus size={17} /> 没找到想请的人
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`h-9 shrink-0 rounded-full px-4 text-sm transition ${category === item ? "bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]" : "bg-[var(--sauna-soft)] text-[var(--sauna-muted-strong)] hover:text-[var(--sauna-text)]"}`}>{item}</button>)}
      </div>

      {error ? <p role="alert" className="mt-4 rounded-[18px] bg-[var(--sauna-danger-soft)] px-4 py-3 text-sm text-[var(--sauna-danger-strong)]">{error}</p> : null}
      {loading ? <CatalogSkeleton /> : visible.length ? (
        <motion.div layout className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item, index) => <CatalogCard key={item.id} item={item} busy={busyId === item.agent.id} index={index} onToggle={() => void toggleInstall(item)} />)}
        </motion.div>
      ) : <div className="mt-5 rounded-[30px] border border-dashed border-[color:var(--sauna-line-strong)] px-6 py-16 text-center text-sm text-[var(--sauna-muted)]">没有找到匹配的人物，可以提交一张上架申请。</div>}

      {token && requests.length ? <section className="mt-10"><h2 className="sauna-display text-3xl tracking-[-0.045em]">我的申请</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{requests.map((item) => <div key={item.id} className="rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-5"><div className="flex items-center justify-between gap-3"><strong>{item.target_name}</strong><span className="text-xs text-[var(--sauna-accent-strong)]">{requestStatus[item.status] ?? item.status}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--sauna-muted)]">{item.admin_note || item.reason || "管理员会评估资料完整度和公共价值。"}</p></div>)}</div></section> : null}

      <AnimatePresence>{requestOpen ? <RequestDialog onClose={() => setRequestOpen(false)} onCreated={(item) => { setRequests((current) => [item, ...current.filter((entry) => entry.id !== item.id)]); setRequestOpen(false); }} /> : null}</AnimatePresence>
    </section>
  );
}

function CatalogCard({ item, busy, index, onToggle }: { item: CatalogEntry; busy: boolean; index: number; onToggle: () => void }) {
  return <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .24), duration: .36, ease: saunaEase }} whileHover={{ y: -4 }} className="group flex min-h-[300px] flex-col rounded-[30px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow-soft)]">
    <div className="flex items-start justify-between gap-4"><span className="grid size-16 place-items-center rounded-[22px] bg-[var(--sauna-soft)] text-4xl shadow-[inset_0_1px_0_var(--sauna-inner-line)]">{item.agent.avatar_emoji || "🧠"}</span>{item.featured ? <Sparkle size={20} weight="duotone" className="text-[var(--sauna-accent)]" /> : null}</div>
    <div className="mt-6"><h2 className="sauna-display text-3xl tracking-[-0.045em]">{item.agent.display_name}</h2><p className="mt-1 text-sm font-medium text-[var(--sauna-accent-strong)]">{item.agent.role_summary}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--sauna-muted-strong)]">{item.summary}</p></div>
    <div className="mt-auto flex items-center gap-2 pt-6"><Link href={`/catalog/${item.agent.slug}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--sauna-soft)] text-sm font-medium text-[var(--sauna-text)] transition hover:bg-[var(--sauna-soft-strong)]">了解他 <ArrowRight size={15} /></Link><button disabled={busy} onClick={onToggle} className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50 ${item.installed ? "border border-[color:var(--sauna-line-strong)] text-[var(--sauna-muted-strong)]" : "bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]"}`}>{item.installed ? <><Check size={15} /> 已添加</> : <><Plus size={15} /> 添加</>}</button></div>
  </motion.article>;
}

function CatalogSkeleton() { return <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="h-[300px] animate-pulse rounded-[30px] bg-[var(--sauna-soft)]" />)}</div>; }

function RequestDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (item: CatalogRequest) => void }) {
  const token = useSaunaStore((state) => state.token)!;
  const reduce = useReducedMotion();
  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    window.requestAnimationFrame(() => nameInputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await createSaunaApiClient(token).createCatalogRequest({
        target_name: name.trim(),
        reason: reason.trim(),
        source_urls: urls.split(/\n|,/).map((value) => value.trim()).filter(Boolean),
      });
      onCreated(item);
    } catch (cause) {
      if (cause instanceof SaunaApiError && cause.code === "catalog_agent_exists") {
        setError("这个人物已经在大厅里，可以直接添加。");
      } else {
        setError(humanizeApiError(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 backdrop-blur-[10px] sm:p-8"
      style={{ background: "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--sauna-panel-strong) 12%, transparent) 0%, var(--sauna-scrim) 76%)" }}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: saunaEase }}
      onMouseDown={busy ? undefined : onClose}
    >
      <motion.div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_45%,var(--sauna-glow-2),transparent_54%)] opacity-25" />
      <motion.form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        initial={reduce ? false : { opacity: 0, y: 20, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: reduce ? 0 : 0.34, ease: saunaEase }}
        className="relative my-auto w-full max-w-xl overflow-hidden rounded-[32px] border border-[color:var(--sauna-line-strong)] bg-[color-mix(in_srgb,var(--sauna-panel-strong)_96%,transparent)] p-7 shadow-[0_36px_120px_var(--sauna-shadow-soft),0_12px_36px_var(--sauna-shadow-soft),inset_0_1px_0_var(--sauna-inner-line)] backdrop-blur-2xl sm:p-8"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-16 top-0 h-px bg-[var(--sauna-accent)] opacity-70" />
        <button type="button" onClick={onClose} disabled={busy} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[var(--sauna-soft)] text-[var(--sauna-muted)] transition hover:bg-[var(--sauna-soft-strong)] hover:text-[var(--sauna-text)] disabled:cursor-not-allowed disabled:opacity-45" aria-label="关闭人物申请">
          <X size={16} />
        </button>
        <p className="text-sm font-medium text-[var(--sauna-accent-strong)]">人物上架申请</p>
        <h2 id={titleId} className="sauna-display mt-2 pr-12 text-4xl tracking-[-0.05em]">你还想和谁聊？</h2>
        <p className="mt-3 max-w-[42ch] text-sm leading-6 text-[var(--sauna-muted-strong)]">告诉我们人物和学习方向，管理员会整理资料并安排蒸馏。</p>
        <div className="mt-6 grid gap-4">
          <input ref={nameInputRef} required value={name} onChange={(event) => setName(event.target.value)} placeholder="人物姓名" className="h-12 rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]" />
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="你希望向他学习什么？" className="resize-none rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] p-4 text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]" />
          <textarea value={urls} onChange={(event) => setUrls(event.target.value)} rows={3} placeholder="可选：公开资料链接，每行一个" className="resize-none rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] p-4 text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]" />
        </div>
        {error ? <p role="alert" className="mt-4 rounded-[16px] bg-[var(--sauna-danger-soft)] px-4 py-3 text-sm text-[var(--sauna-danger-strong)]">{error}</p> : null}
        <button disabled={busy} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "正在提交…" : "提交申请"}<ArrowRight size={15} />
        </button>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
