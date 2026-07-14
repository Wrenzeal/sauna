"use client";

import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowClockwise, ArrowRight, CheckCircle, Key, PencilSimple, SignOut, UserCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAccessUIStore } from "@/store/access-ui-store";
import { useSaunaStore } from "@/store/sauna-store";
import { saunaEase } from "@/lib/motion-system";
import { SaunaApiError } from "@/lib/sauna-api";
import { resendSecondsRemaining, resolveAuthModalStage } from "@/lib/access-policy";

const fieldClass = "h-12 rounded-[18px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 text-sm text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]";
const primaryClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:opacity-45";

function OperationSpinner({ reduce, size = 16 }: { reduce?: boolean | null; size?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      className="block rounded-full border-2 border-current border-r-transparent"
      style={{ width: size, height: size }}
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}

function ModalFrame({ title, eyebrow, children, onClose, closable = true }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void; closable?: boolean }) {
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
      if (event.key === "Escape" && closable) {
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
  }, [closable, onClose]);

  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-[var(--sauna-scrim)] px-4 py-8 backdrop-blur-md" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closable ? onClose : undefined}>
      <motion.section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[calc(100dvh-4rem)] w-full max-w-[520px] overflow-y-auto rounded-[32px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)] sm:p-8" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: 0.34, ease: saunaEase }} onMouseDown={(event) => event.stopPropagation()}>
        {closable ? <button type="button" onClick={onClose} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-[var(--sauna-soft)] text-[var(--sauna-muted)]" aria-label="关闭"><X size={17} /></button> : null}
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--sauna-accent-strong)]">{eyebrow}</p>
        <h2 id={titleId} className="sauna-display mt-3 pr-12 text-4xl tracking-[-0.05em] text-[var(--sauna-text)]">{title}</h2>
        {children}
      </motion.section>
    </motion.div>
  );
}

function AuthModal() {
  const reduce = useReducedMotion();
  const { auth, closeAuth, clearAuthIntent, openProvider } = useAccessUIStore();
  const {
    authOperation,
    authError,
    authErrorCode,
    devCode,
    authCodeSentEmail,
    authResendAvailableAt,
    startEmail,
    verifyEmail,
    resetEmailChallenge,
    completeAuthSuccess,
    clearAuthError,
  } = useSaunaStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const pendingProviderOpenRef = useRef(false);
  const sendBusy = authOperation === "sending_code";
  const verifyBusy = authOperation === "verifying_code";
  const modalStage = resolveAuthModalStage(authOperation, Boolean(authCodeSentEmail));
  const loginSucceeded = modalStage === "success";
  const resendSeconds = resendSecondsRemaining(authResendAvailableAt, clock);

  useEffect(() => {
    if (!authResendAvailableAt || authResendAvailableAt <= Date.now()) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= authResendAvailableAt) {
        window.clearInterval(interval);
        if (authErrorCode === "verification_code_cooldown") clearAuthError();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [authErrorCode, authResendAvailableAt, clearAuthError]);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await startEmail(authCodeSentEmail ?? email);
      setEmail(result.email);
      setCode("");
      setClock(Date.now());
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
    } catch {
      setClock(Date.now());
    }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    try {
      await verifyEmail(authCodeSentEmail ?? email, code);
      const intent = auth.intent;
      const { providers, providerStatus } = useSaunaStore.getState();
      pendingProviderOpenRef.current = intent.kind === "consultation" && providerStatus !== "error" && providers.length === 0;
      window.dispatchEvent(new CustomEvent("sauna-auth-complete", { detail: intent }));
      clearAuthIntent();
      await new Promise((resolve) => window.setTimeout(resolve, reduce ? 250 : 700));
      closeAuth();
    } catch (error) {
      if (error instanceof SaunaApiError && error.code === "invalid_verification_code") {
        setCode("");
        window.requestAnimationFrame(() => codeInputRef.current?.focus());
      }
    }
  }

  function finishAuthExit() {
    completeAuthSuccess();
    if (pendingProviderOpenRef.current) {
      pendingProviderOpenRef.current = false;
      openProvider("create", "provider_missing");
    }
  }

  function changeEmail() {
    resetEmailChallenge();
    setEmail("");
    setCode("");
    window.requestAnimationFrame(() => emailInputRef.current?.focus());
  }

  return (
    <AnimatePresence onExitComplete={finishAuthExit}>
      {auth.open ? <ModalFrame title={loginSucceeded ? "登录成功" : "登录或创建账号"} eyebrow={loginSucceeded ? "WELCOME TO SAUNA" : "YOUR PRIVATE WORKSPACE"} onClose={closeAuth} closable={!verifyBusy && !loginSucceeded}>
        {loginSucceeded ? (
          <motion.div role="status" aria-live="polite" className="grid min-h-64 place-items-center py-8 text-center" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
            <div>
              <motion.span className="mx-auto grid size-20 place-items-center rounded-full bg-[var(--sauna-accent-soft)] text-[var(--sauna-accent-strong)]" initial={reduce ? false : { scale: 0.72, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.42, ease: saunaEase }}>
                <CheckCircle size={42} weight="fill" />
              </motion.span>
              <motion.p className="mt-6 text-base font-semibold text-[var(--sauna-text)]" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.12, duration: 0.32 }}>欢迎回来，正在为你准备智囊团。</motion.p>
              <p className="mt-2 text-sm text-[var(--sauna-muted-strong)]">登录已完成，请稍候。</p>
            </div>
          </motion.div>
        ) : <>
        <p className="mt-4 text-sm leading-7 text-[var(--sauna-muted-strong)]">用邮箱验证码继续。第一次验证会自动为你创建私人工作区。</p>
        <div className="mt-7 grid gap-4">
          {modalStage === "email" ? (
            <form className="grid gap-3" onSubmit={sendCode}>
              <input ref={emailInputRef} autoFocus className={fieldClass} type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearAuthError(); }} placeholder="你的邮箱" autoComplete="email" disabled={sendBusy} required />
              <button className={primaryClass} disabled={sendBusy}>
                {sendBusy ? <><OperationSpinner reduce={reduce} /> 正在发送验证码…</> : <>发送验证码 <ArrowRight size={15} /></>}
              </button>
            </form>
          ) : (
            <>
              <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[22px] border border-[color:var(--sauna-line)] bg-[var(--sauna-accent-soft)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--sauna-accent-strong)]"><CheckCircle size={17} weight="fill" /> 验证码已发送</p>
                    <p className="mt-1 truncate text-xs text-[var(--sauna-muted-strong)]">{authCodeSentEmail}</p>
                  </div>
                  <button type="button" onClick={sendCode} disabled={sendBusy || resendSeconds > 0} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--sauna-panel-strong)] px-3 text-xs font-semibold text-[var(--sauna-accent-strong)] transition disabled:cursor-not-allowed disabled:opacity-55">
                    {sendBusy ? <><OperationSpinner reduce={reduce} size={13} /> 发送中</> : resendSeconds > 0 ? `重新发送 ${resendSeconds}s` : <><ArrowClockwise size={14} /> 重新发送</>}
                  </button>
                </div>
                <button type="button" onClick={changeEmail} disabled={sendBusy || verifyBusy} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sauna-muted)] transition hover:text-[var(--sauna-text)] disabled:opacity-50"><PencilSimple size={13} /> 更换邮箱</button>
              </motion.div>
              <form className="grid gap-3" onSubmit={confirmCode}>
                {devCode ? <div className="rounded-[18px] bg-[var(--sauna-accent-soft)] px-4 py-3 text-sm text-[var(--sauna-accent-strong)]">开发验证码 {devCode}</div> : null}
                <input ref={codeInputRef} autoFocus className={fieldClass} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); clearAuthError(); }} placeholder="输入 6 位验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={Boolean(authError)} disabled={sendBusy || verifyBusy} required />
                <button className={primaryClass} disabled={sendBusy || verifyBusy || code.trim().length !== 6}>
                  {verifyBusy ? <><OperationSpinner reduce={reduce} /> 正在验证…</> : "进入私人工作区"}
                </button>
              </form>
            </>
          )}
          <AnimatePresence mode="wait">
            {authError ? <motion.p key={authError} role="alert" initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm text-[var(--sauna-danger)]">{authError}</motion.p> : null}
          </AnimatePresence>
        </div>
        </>}
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
  const reduce = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const { token, identity, authOperation, logout } = useSaunaStore();
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

  async function signOut() { await logout(); resetAccess(); setOpen(false); }
  const loggingOut = authOperation === "logging_out";
  const initial = identity.user.email.slice(0, 1).toUpperCase();
  return <div ref={menuRef} className="relative"><button type="button" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-full bg-[var(--sauna-primary)] text-sm font-semibold text-[var(--sauna-primary-contrast)]" aria-label="账号菜单" aria-haspopup="menu" aria-expanded={open}>{initial}</button>
    <AnimatePresence>{open ? <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} role="menu" className="absolute right-0 top-12 z-[90] w-64 rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-3 shadow-[var(--sauna-shadow)]">
      <div className="rounded-[18px] bg-[var(--sauna-soft)] p-3"><p className="truncate text-sm font-semibold">{identity.user.email}</p><p className="mt-1 text-xs text-[var(--sauna-muted)]">{identity.workspace.name}</p></div>
      <button onClick={() => { setOpen(false); router.push("/lobby#my-advisors"); }} className="mt-2 flex h-10 w-full items-center rounded-full px-3 text-sm hover:bg-[var(--sauna-soft)]">我的智囊</button>
      <button onClick={() => { setOpen(false); router.push("/settings"); }} className="flex h-10 w-full items-center rounded-full px-3 text-sm hover:bg-[var(--sauna-soft)]">模型设置</button>
      <button onClick={() => void signOut()} disabled={loggingOut} className="flex h-10 w-full items-center gap-2 rounded-full px-3 text-sm text-[var(--sauna-danger)] hover:bg-[var(--sauna-danger-soft)] disabled:cursor-wait disabled:opacity-60">{loggingOut ? <OperationSpinner reduce={reduce} size={14} /> : <SignOut size={15} />} {loggingOut ? "正在退出…" : "退出登录"}</button>
    </motion.div> : null}</AnimatePresence>
  </div>;
}

export function LockedAccessShell({ title, copy }: { title: string; copy: string }) {
  const openAuth = useAccessUIStore((state) => state.openAuth);
  const pathname = usePathname();
  return <section className="grid min-h-[calc(100dvh-7rem)] place-items-center rounded-[36px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 text-center shadow-[var(--sauna-shadow)]"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]"><CheckCircle size={24} /></span><h1 className="sauna-display mt-6 text-4xl tracking-[-0.05em]">{title}</h1><p className="mt-4 text-sm leading-7 text-[var(--sauna-muted-strong)]">{copy}</p><button onClick={() => openAuth("protected_route", { kind: "route", returnTo: pathname })} className={`${primaryClass} mt-7`}>登录或创建账号</button></div></section>;
}
