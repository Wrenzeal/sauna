"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CheckCircle,
  FloppyDisk,
  GearSix,
  Key,
  Lightning,
  PlugsConnected,
  Plus,
  SignOut,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { getSaunaApiBaseUrl, humanizeApiError } from "@/lib/sauna-api";
import { useSaunaStore } from "@/store/sauna-store";
import type { FetchedModel, ProviderConfig, ProviderTestChatResult } from "@/types/sauna";

const fieldClass = "h-11 w-full rounded-[16px] border border-[color:var(--sauna-line)] bg-[var(--sauna-steam)] px-4 text-sm text-[var(--sauna-text)] outline-none transition placeholder:text-[var(--sauna-muted)] focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]";
const selectClass = "min-h-11 w-full rounded-[16px] border border-[color:var(--sauna-line)] bg-[var(--sauna-steam)] px-4 py-3 text-sm text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]";
const primaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-primary)] px-5 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[var(--sauna-soft-strong)]";
const secondaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] px-5 text-sm font-semibold text-[var(--sauna-text)] transition hover:bg-[var(--sauna-soft)] active:translate-y-px disabled:cursor-not-allowed disabled:text-[var(--sauna-muted)]";
const dangerButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--sauna-danger-soft)] px-5 text-sm font-semibold text-[var(--sauna-danger-strong)] transition hover:bg-[var(--sauna-danger-soft)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const providerPresets = [
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    chatModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-small",
    note: "官方接口",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    chatModel: "deepseek-chat",
    embeddingModel: "",
    note: "OpenAI 兼容",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    baseURL: "https://api.siliconflow.cn/v1",
    chatModel: "Qwen/Qwen2.5-7B-Instruct",
    embeddingModel: "BAAI/bge-m3",
    note: "模型市场",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    chatModel: "openai/gpt-4o-mini",
    embeddingModel: "",
    note: "统一路由",
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi",
    baseURL: "https://api.moonshot.cn/v1",
    chatModel: "kimi-k2-0711-preview",
    embeddingModel: "",
    note: "Kimi 接入",
  },
  {
    id: "custom",
    name: "自定义",
    baseURL: "",
    chatModel: "",
    embeddingModel: "",
    note: "自己的网关",
  },
] as const;

type ProviderPreset = (typeof providerPresets)[number];

type Draft = {
  provider_name: string;
  base_url: string;
  api_key: string;
  chat_model: string;
  embedding_model: string;
  is_default: boolean;
};

function draftFromPreset(preset: ProviderPreset = providerPresets[0]): Draft {
  return {
    provider_name: preset.name,
    base_url: preset.baseURL,
    api_key: "",
    chat_model: preset.chatModel,
    embedding_model: preset.embeddingModel,
    is_default: true,
  };
}

function draftFromProvider(provider: ProviderConfig): Draft {
  return {
    provider_name: provider.provider_name,
    base_url: provider.base_url,
    api_key: "",
    chat_model: provider.chat_model,
    embedding_model: provider.embedding_model ?? "",
    is_default: provider.is_default,
  };
}

function formatTime(value?: string | null) {
  if (!value) {
    return "未测试";
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "已测试";
  }
}

function groupModels(models: FetchedModel[]) {
  const groups = new Map<string, FetchedModel[]>();
  for (const model of models) {
    const owner = model.owned_by || "provider";
    groups.set(owner, [...(groups.get(owner) ?? []), model]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function SettingsPanel() {
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
    startEmail,
    verifyEmail,
    logout,
    loadIdentity,
    loadProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    setDefaultProvider,
    fetchProviderModels,
    discoverProviderModels,
    testProviderChat,
  } = useSaunaStore();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("openai");
  const [selectedProviderId, setSelectedProviderId] = useState<string>();
  const [draft, setDraft] = useState<Draft>(() => draftFromPreset());
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [testResult, setTestResult] = useState<ProviderTestChatResult>();
  const [localMessage, setLocalMessage] = useState<string>();
  const [localError, setLocalError] = useState<string>();

  const providerList = providers ?? [];
  const isLoggedIn = Boolean(token && identity);
  const busy = providerStatus === "loading";
  const authBusy = authStatus === "loading";
  const selectedProvider = providerList.find((provider) => provider.id === selectedProviderId);
  const modelGroups = useMemo(() => groupModels(models), [models]);
  const codeEmail = authCodeSentEmail ?? email;
  const hasCodeSent = Boolean(authCodeSentEmail);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (token) {
      void loadProviders(token);
    }
  }, [loadProviders, token]);

  function updateDraft(key: keyof Draft, value: string | boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function clearFeedback() {
    setLocalError(undefined);
    setLocalMessage(undefined);
    setTestResult(undefined);
  }

  function startNew(presetId = selectedPresetId) {
    const preset = providerPresets.find((item) => item.id === presetId) ?? providerPresets[0];
    setSelectedPresetId(preset.id);
    setSelectedProviderId(undefined);
    setDraft(draftFromPreset(preset));
    setModels([]);
    clearFeedback();
  }

  function applyPreset(presetId: string) {
    const preset = providerPresets.find((item) => item.id === presetId) ?? providerPresets[0];
    setSelectedPresetId(preset.id);
    setDraft((current) => ({
      ...current,
      provider_name: preset.name,
      base_url: preset.baseURL,
      chat_model: preset.chatModel,
      embedding_model: preset.embeddingModel,
    }));
    setModels([]);
    clearFeedback();
  }

  function editProvider(provider: ProviderConfig) {
    setSelectedProviderId(provider.id);
    setDraft(draftFromProvider(provider));
    setModels([]);
    clearFeedback();
  }

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

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    try {
      if (selectedProviderId) {
        await updateProvider(selectedProviderId, draft);
        setDraft((current) => ({ ...current, api_key: "" }));
        setLocalMessage("配置已更新。");
      } else {
        const provider = await createProvider(draft);
        setSelectedProviderId(provider.id);
        setDraft((current) => ({ ...current, api_key: "" }));
        setLocalMessage("配置已保存。");
      }
    } catch (error) {
      setLocalError(humanizeApiError(error));
    }
  }

  async function fetchModels() {
    clearFeedback();
    try {
      const nextModels = selectedProviderId && !draft.api_key.trim()
        ? await fetchProviderModels(selectedProviderId)
        : await discoverProviderModels({ base_url: draft.base_url, api_key: draft.api_key });
      setModels(nextModels);
      setLocalMessage(nextModels.length ? `获取到 ${nextModels.length} 个模型。` : "没有返回模型。");
    } catch (error) {
      setLocalError(humanizeApiError(error));
    }
  }

  async function testChat() {
    if (!selectedProviderId) {
      setLocalError("请先保存配置，再测试对话。");
      return;
    }
    clearFeedback();
    try {
      const result = await testProviderChat(selectedProviderId);
      setTestResult(result);
      setLocalMessage("测试完成。");
    } catch (error) {
      setLocalError(humanizeApiError(error));
    }
  }

  async function makeDefault(id: string) {
    clearFeedback();
    try {
      await setDefaultProvider(id);
      setLocalMessage("默认模型已切换。");
    } catch (error) {
      setLocalError(humanizeApiError(error));
    }
  }

  async function removeProvider() {
    if (!selectedProviderId || !window.confirm("删除这个模型配置？")) {
      return;
    }
    clearFeedback();
    try {
      await deleteProvider(selectedProviderId);
      startNew();
      setLocalMessage("配置已删除。");
    } catch (error) {
      setLocalError(humanizeApiError(error));
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="grid min-h-[calc(100dvh-7rem)] place-items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[520px] rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-6 shadow-[var(--sauna-shadow)] backdrop-blur-xl"
        >
          <div className="grid size-16 place-items-center rounded-[24px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]">
            <UserCircle size={28} weight="duotone" />
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-[var(--sauna-text)]">先登录。</h1>
          <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-[var(--sauna-muted)]">登录后保存你的 Base URL、Key 和默认模型。</p>

          <div className="mt-6 grid gap-3">
            <form className="grid gap-3" onSubmit={submitEmail}>
              <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
                邮箱
                <input
                  className={fieldClass}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <button className={primaryButtonClass} type="submit" disabled={authBusy || !email.trim()}>
                {hasCodeSent ? "重新发送验证码" : "发送验证码"}
              </button>
            </form>

            {hasCodeSent ? (
              <form className="grid gap-3" onSubmit={submitCode}>
                <div className="rounded-[22px] bg-[var(--sauna-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--sauna-accent-strong)]">
                  {devCode ? `开发验证码 ${devCode}` : `验证码已发送至 ${codeEmail}`}
                </div>
                <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
                  验证码
                  <input
                    className={fieldClass}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="6 位数字"
                    inputMode="numeric"
                    required
                  />
                </label>
                <button className={primaryButtonClass} type="submit" disabled={authBusy || !code.trim()}>
                  登录
                </button>
              </form>
            ) : null}
            {authError ? <p className="text-sm leading-relaxed text-[var(--sauna-danger)]">{authError}</p> : null}
          </div>
        </motion.div>
      </section>
    );
  }

  return (
    <section className="grid min-h-[calc(100dvh-7rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-6"
      >
        <motion.div
          className="pointer-events-none absolute right-[8%] top-[10%] size-48 rounded-full bg-[var(--sauna-accent-soft)] blur-2xl"
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.48, 0.78, 0.48] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--sauna-muted)]">设置</p>
            <h1 className="mt-3 max-w-[9ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[var(--sauna-text)] sm:text-6xl">模型中枢。</h1>
            <p className="mt-5 max-w-none whitespace-nowrap text-sm leading-relaxed text-[var(--sauna-muted-strong)]">把供应商、Key 和模型集中管理。保存后，大厅会使用真实调用。</p>
          </div>
          <div className="rounded-[28px] bg-[var(--sauna-panel-strong)] p-4 shadow-[var(--sauna-shadow)]">
            <p className="text-xs font-medium text-[var(--sauna-muted)]">API Proxy</p>
            <p className="mt-2 break-all text-sm font-semibold text-[var(--sauna-text)]">{getSaunaApiBaseUrl()}</p>
          </div>
        </div>

        <div className="relative mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {providerList.length === 0 ? (
            <div className="md:col-span-2 2xl:col-span-3 rounded-[32px] border border-dashed border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-8 text-center">
              <PlugsConnected size={30} className="mx-auto text-[var(--sauna-accent)]" />
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)]">还没有模型配置</h2>
              <p className="mt-2 text-sm text-[var(--sauna-muted)]">选择一个预设，填入 Key 后保存。</p>
            </div>
          ) : (
            providerList.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => editProvider(provider)}
                className={`group rounded-[32px] border p-5 text-left shadow-[var(--sauna-shadow)] transition hover:-translate-y-1 active:translate-y-px ${selectedProviderId === provider.id ? "border-[color:var(--sauna-accent)] bg-[var(--sauna-accent-soft)]" : "border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)]"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-13 place-items-center rounded-[20px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]">
                    <Key size={22} weight="duotone" />
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${provider.is_default ? "bg-[var(--sauna-accent-soft)] text-[var(--sauna-accent-strong)]" : "bg-[var(--sauna-soft-strong)] text-[var(--sauna-muted)]"}`}>
                    {provider.is_default ? "默认" : provider.status}
                  </span>
                </div>
                <h2 className="mt-5 truncate text-2xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)]">{provider.provider_name}</h2>
                <p className="mt-2 truncate text-sm text-[var(--sauna-muted)]">{provider.chat_model}</p>
                <div className="mt-5 grid gap-2 text-xs text-[var(--sauna-muted)]">
                  <span className="truncate">{provider.base_url}</span>
                  <span>{provider.masked_api_key}</span>
                  <span>测试 {formatTime(provider.last_tested_at)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>

      <motion.aside
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.05em] text-[var(--sauna-text)]">{selectedProvider ? "编辑接入" : "新增接入"}</h2>
            <p className="mt-1 text-sm text-[var(--sauna-muted)]">OpenAI 兼容协议优先。</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="grid size-11 place-items-center rounded-full bg-[var(--sauna-soft-strong)] text-[var(--sauna-muted)] transition hover:text-[var(--sauna-text)] active:translate-y-px"
            aria-label="退出登录"
          >
            <SignOut size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-[24px] bg-[var(--sauna-soft-strong)] p-3 text-sm text-[var(--sauna-muted-strong)]">
          <p className="font-semibold text-[var(--sauna-text)]">{identity?.user.email}</p>
          <p className="mt-1 text-xs text-[var(--sauna-muted)]">{identity?.workspace.name}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {providerPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`rounded-[20px] px-4 py-3 text-left transition active:translate-y-px ${selectedPresetId === preset.id ? "bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)]" : "bg-[var(--sauna-soft-strong)] text-[var(--sauna-text)] hover:bg-[var(--sauna-soft)]"}`}
            >
              <span className="block text-sm font-semibold">{preset.name}</span>
              <span className={`mt-1 block text-xs ${selectedPresetId === preset.id ? "text-[var(--sauna-primary-contrast-muted)]" : "text-[var(--sauna-muted)]"}`}>{preset.note}</span>
            </button>
          ))}
        </div>

        <form className="mt-5 grid gap-4" onSubmit={saveProvider}>
          <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
            供应商名称
            <input className={fieldClass} value={draft.provider_name} onChange={(event) => updateDraft("provider_name", event.target.value)} placeholder="OpenAI Compatible" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
            Base URL
            <input className={fieldClass} value={draft.base_url} onChange={(event) => updateDraft("base_url", event.target.value)} placeholder="https://api.openai.com/v1" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
            API Key
            <input
              className={fieldClass}
              value={draft.api_key}
              onChange={(event) => updateDraft("api_key", event.target.value)}
              placeholder={selectedProvider ? "留空则保留原 Key" : "sk-..."}
              type="password"
              autoComplete="off"
              required={!selectedProvider}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
            对话模型
            <input className={fieldClass} value={draft.chat_model} onChange={(event) => updateDraft("chat_model", event.target.value)} placeholder="gpt-4.1-mini" required />
          </label>
          {modelGroups.length ? (
            <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
              选择已获取模型
              <select className={selectClass} value={draft.chat_model} onChange={(event) => updateDraft("chat_model", event.target.value)}>
                {modelGroups.map(([owner, items]) => (
                  <optgroup key={owner} label={owner}>
                    {items.map((model) => (
                      <option key={model.id} value={model.id}>{model.id}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-medium text-[var(--sauna-muted-strong)]">
            向量模型
            <input className={fieldClass} value={draft.embedding_model} onChange={(event) => updateDraft("embedding_model", event.target.value)} placeholder="text-embedding-3-small" />
          </label>
          <label className="flex items-center gap-3 rounded-[20px] bg-[var(--sauna-steam)] p-3 text-sm font-medium text-[var(--sauna-muted-strong)]">
            <input className="size-4 accent-[var(--sauna-accent)]" type="checkbox" checked={draft.is_default} onChange={(event) => updateDraft("is_default", event.target.checked)} />
            设为默认调用模型
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button className={primaryButtonClass} type="submit" disabled={busy}>
              <FloppyDisk size={17} weight="duotone" />
              保存
            </button>
            <button className={secondaryButtonClass} type="button" onClick={fetchModels} disabled={busy || !draft.base_url.trim() || (!selectedProviderId && !draft.api_key.trim())}>
              <GearSix size={17} weight="duotone" />
              获取模型
            </button>
          </div>
        </form>

        <div className="mt-3 grid gap-2">
          <button className={secondaryButtonClass} type="button" onClick={testChat} disabled={busy || !selectedProviderId}>
            <Lightning size={17} weight="duotone" />
            测试对话
          </button>
          {selectedProvider ? (
            <div className="grid grid-cols-2 gap-2">
              <button className={secondaryButtonClass} type="button" onClick={() => void makeDefault(selectedProvider.id)} disabled={busy || selectedProvider.is_default}>
                <CheckCircle size={17} weight="duotone" />
                设为默认
              </button>
              <button className={dangerButtonClass} type="button" onClick={removeProvider} disabled={busy}>
                <Trash size={17} weight="duotone" />
                删除
              </button>
            </div>
          ) : (
            <button className={secondaryButtonClass} type="button" onClick={() => startNew()} disabled={busy}>
              <Plus size={17} weight="duotone" />
              清空表单
            </button>
          )}
        </div>

        {testResult ? (
          <div className="mt-4 rounded-[24px] bg-[var(--sauna-primary)] p-4 text-[var(--sauna-primary-contrast)]">
            <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle size={17} weight="fill" className="text-[var(--sauna-primary-contrast)]" />模型已响应</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--sauna-primary-contrast-muted)]">{testResult.content || "ok"}</p>
            <p className="mt-3 text-xs text-[var(--sauna-primary-contrast-muted)]">{testResult.latency_ms} ms</p>
          </div>
        ) : null}

        {localMessage ? <p className="mt-4 rounded-[20px] bg-[var(--sauna-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--sauna-accent-strong)]">{localMessage}</p> : null}
        {(localError || providerError) ? (
          <div className="mt-4 flex gap-3 rounded-[20px] bg-[var(--sauna-danger-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--sauna-danger-strong)]">
            <WarningCircle size={18} className="shrink-0" />
            <span>{localError || providerError}</span>
          </div>
        ) : null}
      </motion.aside>
    </section>
  );
}
