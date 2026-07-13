"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowClockwise, ArrowRight, CheckCircle, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useSaunaStore } from "@/store/sauna-store";

const statusText: Record<string, string> = {
  queued: "排队中",
  researching: "调研中",
  extracting: "提炼中",
  validating: "校验中",
  completed: "已完成",
  failed: "失败",
};

export function StudioPanel() {
  const reduce = useReducedMotion();
  const token = useSaunaStore((state) => state.token);
  const providers = useSaunaStore((state) => state.providers ?? []);
  const jobs = useSaunaStore((state) => state.distillationJobs ?? []);
  const status = useSaunaStore((state) => state.distillationStatus);
  const error = useSaunaStore((state) => state.distillationError);
  const loadJobs = useSaunaStore((state) => state.loadDistillationJobs);
  const loadAgents = useSaunaStore((state) => state.loadWorkspaceAgents);
  const createJob = useSaunaStore((state) => state.createDistillationJob);
  const [targetName, setTargetName] = useState("");
  const [inputBrief, setInputBrief] = useState("");
  const [sourceURLs, setSourceURLs] = useState("");
  const [notice, setNotice] = useState("");

  const defaultProvider = useMemo(() => providers.find((item) => item.is_default) ?? providers[0], [providers]);
  const busy = status === "loading";

  useEffect(() => {
    if (token) {
      void loadJobs();
    }
  }, [loadJobs, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const name = targetName.trim();
    if (!name) {
      setNotice("先输入要蒸馏的人物。");
      return;
    }
    try {
      await createJob({
        target_name: name,
        target_type: "person",
        input_brief: inputBrief.trim(),
        source_urls: sourceURLs.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
        provider_config_id: defaultProvider?.id,
      });
      setNotice("已提交给 nuwa-skill agent，完成后会出现在智囊大厅。");
      setTargetName("");
      setInputBrief("");
      setSourceURLs("");
    } catch {
      setNotice("提交失败，请检查登录状态和后端服务。");
    }
  }

  return (
    <section className="grid min-h-[calc(100dvh-7rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative overflow-hidden rounded-[38px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-4 shadow-[var(--sauna-shadow)] backdrop-blur-xl sm:p-6">
        <motion.div
          className="pointer-events-none absolute right-[10%] top-[10%] size-64 rounded-full bg-[color-mix(in_srgb,var(--sauna-accent-soft)_62%,transparent)] blur-3xl"
          animate={reduce ? undefined : { opacity: [0.36, 0.62, 0.36], scale: [1, 1.04, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="flex min-h-[560px] flex-col justify-between rounded-[32px] border border-[color:var(--sauna-inner-line)] bg-[var(--sauna-soft)] p-6 sm:p-8">
            <div>
              <p className="text-sm font-medium text-[var(--sauna-muted)]">管理工作室</p>
              <h1 className="mt-4 max-w-[9ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[var(--sauna-text)] sm:text-6xl">
                用 nuwa 生成 Skill。
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--sauna-muted-strong)]">
                输入人物和资料线索，Sauna 会创建异步任务，让 nuwa-skill agent 生成可加载的 SKILL.md。
              </p>
            </div>
            <div className="mt-8 grid gap-3">
              {[
                ["默认智囊", "来自 nuwa 已蒸馏成品"],
                ["自定义人物", "生成你的私有 Skill"],
                ["对话加载", "会话时注入 SKILL.md"],
              ].map(([title, copy], index) => (
                <motion.div
                  key={title}
                  className="flex items-center justify-between rounded-[24px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-4"
                  animate={reduce ? undefined : { opacity: [0.88, 1, 0.88] }}
                  transition={{ duration: 9 + index, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--sauna-text)]">{title}</p>
                    <p className="mt-1 text-xs text-[var(--sauna-muted)]">{copy}</p>
                  </div>
                  <Sparkle size={18} className="text-[var(--sauna-accent-strong)]" />
                </motion.div>
              ))}
            </div>
          </div>

          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[32px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] sm:p-7"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[color:var(--sauna-line)] pb-5">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-[20px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] text-[var(--sauna-accent-strong)]">
                  <Sparkle size={21} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.035em] text-[var(--sauna-text)]">Nuwa Skill</h2>
                  <p className="mt-1 text-xs text-[var(--sauna-muted)]">异步生成 Agent Skill</p>
                </div>
              </div>
              <span className="rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-3 py-1 text-xs font-medium text-[var(--sauna-muted)]">Job</span>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[var(--sauna-muted-strong)]">人物</span>
                <input
                  value={targetName}
                  onChange={(event) => setTargetName(event.target.value)}
                  placeholder="例如：张小龙、段永平、彼得蒂尔"
                  className="h-13 rounded-[20px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 text-sm text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[var(--sauna-muted-strong)]">生成目标</span>
                <textarea
                  value={inputBrief}
                  onChange={(event) => setInputBrief(event.target.value)}
                  placeholder="你希望学习他的哪类判断：产品、投资、组织、表达、人生选择..."
                  rows={5}
                  className="resize-none rounded-[22px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 py-3 text-sm leading-6 text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[var(--sauna-muted-strong)]">资料链接</span>
                <textarea
                  value={sourceURLs}
                  onChange={(event) => setSourceURLs(event.target.value)}
                  placeholder="每行一个公开资料链接。第一版会记录进任务，后续接入检索和上传资料。"
                  rows={3}
                  className="resize-none rounded-[22px] border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] px-4 py-3 text-sm leading-6 text-[var(--sauna-text)] outline-none transition focus:border-[var(--sauna-accent)] focus:bg-[var(--sauna-panel-strong)]"
                />
              </label>
            </div>

            <div className="mt-5 rounded-[22px] bg-[var(--sauna-soft)] px-4 py-3 text-xs leading-5 text-[var(--sauna-muted-strong)]">
              模型：{defaultProvider ? `${defaultProvider.provider_name} / ${defaultProvider.chat_model}` : "未配置，仍可创建任务，但真实蒸馏前需要 provider。"}
            </div>
            {(notice || error) && <p className="mt-4 text-sm text-[var(--sauna-muted)]">{error ?? notice}</p>}
            <button
              type="submit"
              disabled={busy || !token}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--sauna-primary)] px-6 text-sm font-semibold text-[var(--sauna-primary-contrast)] transition hover:bg-[var(--sauna-primary-hover)] disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px"
            >
              {busy ? <ArrowClockwise size={16} className="animate-spin" /> : <ArrowRight size={15} />}
              {token ? "开始生成" : "登录后生成"}
            </button>
          </motion.form>
        </div>
      </div>

      <aside className="grid content-start gap-4">
        <div className="rounded-[34px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel-strong)] p-5 shadow-[var(--sauna-shadow)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[var(--sauna-text)]">任务</h2>
            <button onClick={() => { void loadJobs(); void loadAgents(); }} className="grid size-9 place-items-center rounded-full border border-[color:var(--sauna-line)] bg-[var(--sauna-soft)] text-[var(--sauna-muted)] transition hover:text-[var(--sauna-text)]" aria-label="刷新蒸馏任务">
              <ArrowClockwise size={16} />
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {jobs.length === 0 ? (
              <p className="rounded-[22px] bg-[var(--sauna-soft)] p-4 text-sm text-[var(--sauna-muted)]">还没有蒸馏任务。</p>
            ) : jobs.map((job) => (
              <div key={job.id} className="rounded-[22px] border border-[color:var(--sauna-line)] bg-[var(--sauna-panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold tracking-[-0.025em] text-[var(--sauna-text)]">{job.target_name}</p>
                  {job.status === "completed" ? <CheckCircle size={18} className="text-[var(--sauna-success)]" /> : job.status === "failed" ? <WarningCircle size={18} className="text-[var(--sauna-danger)]" /> : <ArrowClockwise size={16} className="animate-spin text-[var(--sauna-muted)]" />}
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--sauna-muted)]">{statusText[job.status] ?? job.status}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--sauna-muted)]">{job.error_message || job.progress_message}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
