"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CheckCircle,
  GearSix,
  Key,
  SignOut,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useSaunaStore } from "@/store/sauna-store";

const fieldClass = "h-11 rounded-full border border-[#563a24]/[0.10] bg-[#f8efe3] px-4 text-sm text-[var(--sauna-text)] outline-none transition placeholder:text-[#a08c78] focus:border-[#b77945] focus:bg-[#fffdf7]";
const buttonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-espresso)] px-5 text-sm font-semibold text-[#fff8ec] transition hover:bg-[var(--sauna-espresso-2)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#c8b6a0]";

export function ApiSetupCard() {
  const reduce = useReducedMotion();
  const {
    token,
    identity,
    providers,
    devCode,
    authCodeSentEmail,
    authStatus,
    providerStatus,
    authError,
    providerError,
    apiError,
    startEmail,
    verifyEmail,
    logout,
  } = useSaunaStore();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const defaultProvider = useMemo(() => {
    const providerList = providers ?? [];
    return providerList.find((provider) => provider.is_default) ?? providerList[0];
  }, [providers]);
  const isLoggedIn = Boolean(token && identity);
  const authBusy = authStatus === "loading";
  const providerBusy = providerStatus === "loading";
  const codeEmail = authCodeSentEmail ?? email;
  const hasCodeSent = Boolean(authCodeSentEmail);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await startEmail(email);
    setEmail(result.email);
    setCode("");
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyEmail(codeEmail, code);
    setCode("");
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[34px] border border-[#563a24]/[0.10] bg-[#fffdf7]/84 p-5 shadow-[0_20px_60px_rgb(84_54_32_/_0.08)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--sauna-text)]">登录</h2>
          <p className="mt-1 text-xs text-[var(--sauna-muted)]">登录后保存你的设置和咨询记录。</p>
        </div>
        {isLoggedIn ? <CheckCircle size={24} weight="fill" className="text-[#b77945]" /> : <UserCircle size={24} className="text-[var(--sauna-muted)]" />}
      </div>

      {apiError ? (
        <div className="mt-4 flex gap-3 rounded-[22px] bg-[#f2d6c8] p-3 text-xs leading-relaxed text-[#8a4f32]">
          <WarningCircle size={17} className="shrink-0" />
          <span>{apiError}</span>
        </div>
      ) : null}

      {!isLoggedIn ? (
        <div className="mt-5 grid gap-3">
          <form className="grid gap-2" onSubmit={submitEmail}>
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="你的邮箱"
              autoComplete="email"
              required
            />
            <button className={buttonClass} type="submit" disabled={authBusy}>
              {hasCodeSent ? "重新发送验证码" : "发送验证码"}
            </button>
          </form>
          {hasCodeSent ? (
            <form className="grid gap-2" onSubmit={submitCode}>
              <div className="rounded-[22px] bg-[#f3dcc2] px-4 py-3 text-sm font-semibold text-[#7a4728]">
                {devCode ? `开发验证码 ${devCode}` : `验证码已发送至 ${codeEmail}`}
              </div>
              <input
                className={fieldClass}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="输入验证码"
                inputMode="numeric"
                required
              />
              <button className={buttonClass} type="submit" disabled={authBusy}>
                登录
              </button>
            </form>
          ) : null}
          {authError ? <p className="text-xs leading-relaxed text-[#a75b3f]">{authError}</p> : null}
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#f2e4d2] p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--sauna-text)]">{identity?.user.email}</p>
              <p className="mt-1 text-xs text-[var(--sauna-muted)]">{identity?.workspace.name}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fffdf7] text-[var(--sauna-muted)] transition hover:text-[var(--sauna-text)] active:translate-y-px"
              aria-label="退出登录"
            >
              <SignOut size={18} />
            </button>
          </div>

          {defaultProvider ? (
            <div className="rounded-[24px] bg-[var(--sauna-espresso)] p-4 text-[#fff8ec]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Key size={17} weight="duotone" className="text-[#f3dcc2]" />
                {defaultProvider.provider_name}
              </div>
              <p className="mt-2 text-xs text-[#fff8ec]/68">{defaultProvider.chat_model}</p>
              <p className="mt-1 text-xs text-[#fff8ec]/54">{defaultProvider.masked_api_key}</p>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f2e4d2] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sauna-text)]">
                <GearSix size={17} weight="duotone" className="text-[#b77945]" />
                需要配置模型
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--sauna-muted)]">到设置页填入 Base URL、Key 和模型名。</p>
              {providerError ? <p className="text-xs leading-relaxed text-[#a75b3f]">{providerError}</p> : null}
            </div>
          )}
          <Link href="/settings" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#b77945] px-5 text-sm font-semibold text-[#fff8ec] transition hover:bg-[#965f36] active:translate-y-px">
            模型设置 <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </motion.div>
  );
}
