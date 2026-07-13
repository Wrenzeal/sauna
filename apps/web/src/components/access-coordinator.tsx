"use client";

import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Key, SignOut, UserCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAccessUIStore } from "@/store/access-ui-store";
import { useSaunaStore } from "@/store/sauna-store";
import { saunaEase } from "@/lib/motion-system";

const fieldClass = "h-12 rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 text-sm text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]";
const primaryClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:opacity-45";

function ModalFrame({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const initialTarget = dialog?.querySelector<HTMLElement>("[autofocus]") ?? dialog?.querySelector<HTMLElement>(focusableSelector);
    initialTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
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
      window.requestAnimationFrame(() => {
        if (!document.querySelector('[role="dialog"]')) previousFocus?.focus();
      });
    };
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[var(--sauna-scrim)] px-4 py-8 backdrop-blur-md" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[calc(100dvh-4rem)] w-full max-w-[520px] overflow-y-auto rounded-[32px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)] sm:p-8" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: 0.34, ease: saunaEase }} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-[var(--sauna-soft)] text-[var(--sauna-muted)]" aria-label="关闭"><X size={17} /></button>
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--sauna-accent-strong)]">{eyebrow}</p>
        <h2 id={titleId} className="sauna-display mt-3 pr-12 text-4xl tracking-[-0.05em] text-[var(--sauna-text)]">{title}</h2>
        {children}
      </motion.section>
    </motion.div>
  );
}

function AuthModal() {
  const { auth, closeAuth, clearAuthIntent, openProvider } = useAccessUIStore();
  const { authStatus, authError, devCode, authCodeSentEmail, startEmail, verifyEmail } = useSaunaStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  async function sendCode(event: FormEvent) { event.preventDefault(); await startEmail(email); }
  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    await verifyEmail(authCodeSentEmail ?? email, code);
    const intent = auth.intent;
    window.dispatchEvent(new CustomEvent("sauna-auth-complete", { detail: intent }));
    clearAuthIntent();
    closeAuth();
    if (intent.kind === "consultation" && useSaunaStore.getState().providers.length === 0) openProvider("create", "provider_missing");
  }

  return (
    <AnimatePresence>
      {auth.open ? <ModalFrame title="登录或创建账号" eyebrow="YOUR PRIVATE WORKSPACE" onClose={closeAuth}>
        <p className="mt-4 text-sm leading-7 text-[var(--sauna-muted-strong)]">用邮箱验证码继续。第一次验证会自动为你创建私人工作区。</p>
        <div className="mt-7 grid gap-4">
          <form className="grid gap-3" onSubmit={sendCode}>
            <input autoFocus className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="你的邮箱" autoComplete="email" required />
            <button className={primaryClass} disabled={authStatus === "loading"}>{authCodeSentEmail ? "重新发送验证码" : "发送验证码"}<ArrowRight size={15} /></button>
          </form>
          {authCodeSentEmail ? <form className="grid gap-3" onSubmit={confirmCode}>
            <div className="rounded-[18px] bg-[var(--sauna-accent-soft)] px-4 py-3 text-sm text-[var(--sauna-accent-strong)]">{devCode ? `开发验证码 ${devCode}` : `验证码已发送至 ${authCodeSentEmail}`}</div>
            <input className={fieldClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入验证码" inputMode="numeric" required />
            <button className={primaryClass} disabled={authStatus === "loading"}>进入私人工作区</button>
          </form> : null}
          {authError ? <p role="alert" className="text-sm text-[var(--sauna-danger)]">{authError}</p> : null}
        </div>
      </ModalFrame> : null}
    </AnimatePresence>
  );
}

function ProviderModalForm({ current, mode, onSaved }: { current?: ReturnType<typeof useSaunaStore.getState>["providers"][number]; mode: "create" | "repair"; onSaved: () => void }) {
  const { providerStatus, providerError, createProvider, updateProvider } = useSaunaStore();
  const [name, setName] = useState(current?.provider_name ?? "OpenAI Compatible");
  const [baseURL, setBaseURL] = useState(current?.base_url ?? "https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(current?.chat_model ?? "gpt-4.1-mini");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (current && mode === "repair") await updateProvider(current.id, { provider_name: name, base_url: baseURL, api_key: apiKey, chat_model: model, embedding_model: current.embedding_model, is_default: true });
    else await createProvider({ provider_name: name, base_url: baseURL, api_key: apiKey, chat_model: model, is_default: true });
    onSaved();
  }

  return <form className="mt-7 grid gap-3" onSubmit={save}>
    <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="供应商名称" required />
    <input className={fieldClass} value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="Base URL" required />
    <input className={fieldClass} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={current ? "留空则保留原 Key" : "API Key"} type="password" required={!current || mode === "create"} />
    <input className={fieldClass} value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型名称" required />
    <button className={primaryClass} disabled={providerStatus === "loading"}><Key size={16} /> 保存模型配置</button>
    {providerError ? <p role="alert" className="text-sm text-[var(--sauna-danger)]">{providerError}</p> : null}
  </form>;
}

function ProviderModal() {
  const { provider, closeProvider } = useAccessUIStore();
  const providers = useSaunaStore((state) => state.providers);
  const current = providers.find((item) => item.is_default) ?? providers[0];
  return <AnimatePresence>{provider.open ? <ModalFrame title={provider.mode === "repair" ? "修复模型配置" : "接入你的模型"} eyebrow="MODEL PROVIDER" onClose={closeProvider}>
    <p className="mt-4 text-sm leading-7 text-[var(--sauna-muted-strong)]">配置只保存在你的私人工作区。保存后回到原问题，由你再次确认发送。</p>
    <ProviderModalForm key={`${provider.mode}:${current?.id ?? "new"}`} current={current} mode={provider.mode} onSaved={closeProvider} />
  </ModalFrame> : null}</AnimatePresence>;
}

export function AccessCoordinatorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const invalidateSession = useSaunaStore((state) => state.invalidateSession);
  const token = useSaunaStore((state) => state.token);
  const identity = useSaunaStore((state) => state.identity);
  const loadIdentity = useSaunaStore((state) => state.loadIdentity);
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const openProvider = useAccessUIStore((state) => state.openProvider);

  useEffect(() => {
    if (token && !identity) void loadIdentity().catch(() => undefined);
  }, [identity, loadIdentity, token]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: "unauthorized" | "provider_required" | "provider_failure" }>).detail;
      if (detail.kind === "unauthorized") {
        invalidateSession();
        openAuth("reauth", { kind: "route", returnTo: pathname });
      } else if (detail.kind === "provider_required") openProvider("create", "provider_required");
      else if (detail.kind === "provider_failure") openProvider("repair", "provider_repair");
    };
    window.addEventListener("sauna-access-error", handler);
    return () => window.removeEventListener("sauna-access-error", handler);
  }, [invalidateSession, openAuth, openProvider, pathname]);

  return <>{children}<AuthModal /><ProviderModal /></>;
}

export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, identity, logout } = useSaunaStore();
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const resetAccess = useAccessUIStore((state) => state.reset);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!token || !identity) return <button type="button" onClick={() => openAuth("entry_login", { kind: "route", returnTo: pathname })} className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--sauna-muted-strong)] transition hover:bg-[var(--sauna-soft)]"><UserCircle size={17} className="mr-2" /> 登录</button>;

  async function signOut() { await logout(); resetAccess(); setOpen(false); router.push("/lobby"); }
  const initial = identity.user.email.slice(0, 1).toUpperCase();
  return <div ref={menuRef} className="relative"><button type="button" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-full bg-[var(--sauna-primary)] text-sm font-semibold text-[var(--sauna-primary-contrast)]" aria-label="账号菜单" aria-haspopup="menu" aria-expanded={open}>{initial}</button>
    <AnimatePresence>{open ? <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} role="menu" className="absolute right-0 top-12 z-[90] w-64 rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-3 shadow-[var(--sauna-shadow)]">
      <div className="rounded-[18px] bg-[var(--sauna-soft)] p-3"><p className="truncate text-sm font-semibold">{identity.user.email}</p><p className="mt-1 text-xs text-[var(--sauna-muted)]">{identity.workspace.name}</p></div>
      <button onClick={() => { setOpen(false); router.push("/lobby#my-advisors"); }} className="mt-2 flex h-10 w-full items-center rounded-full px-3 text-sm hover:bg-[var(--sauna-soft)]">我的智囊</button>
      <button onClick={() => { setOpen(false); router.push("/settings"); }} className="flex h-10 w-full items-center rounded-full px-3 text-sm hover:bg-[var(--sauna-soft)]">模型设置</button>
      <button onClick={() => void signOut()} className="flex h-10 w-full items-center gap-2 rounded-full px-3 text-sm text-[var(--sauna-danger)] hover:bg-[var(--sauna-danger-soft)]"><SignOut size={15} /> 退出登录</button>
    </motion.div> : null}</AnimatePresence>
  </div>;
}

export function LockedAccessShell({ title, copy }: { title: string; copy: string }) {
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const pathname = usePathname();
  return <section className="grid min-h-[calc(100dvh-7rem)] place-items-center rounded-[36px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 text-center shadow-[var(--sauna-shadow)]"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]"><CheckCircle size={24} /></span><h1 className="sauna-display mt-6 text-4xl tracking-[-0.05em]">{title}</h1><p className="mt-4 text-sm leading-7 text-[var(--sauna-muted-strong)]">{copy}</p><button onClick={() => openAuth("protected_route", { kind: "route", returnTo: pathname })} className={`${primaryClass} mt-7`}>登录或创建账号</button></div></section>;
}
