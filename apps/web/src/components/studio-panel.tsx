"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowClockwise, ArrowRight, CheckCircle, Flask, Sparkle, WarningCircle } from "@phosphor-icons/react";
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
      <div className="relative overflow-hidden rounded-[38px] border border-black/[0.08] bg-[#fbfbf8]/88 p-4 shadow-[0_26px_90px_rgb(28_34_24_/_0.10)] backdrop-blur-xl sm:p-6">
        <motion.div
          className="pointer-events-none absolute right-[8%] top-[8%] size-56 rounded-full bg-[#dfeadc]/80 blur-3xl"
          animate={reduce ? undefined : { x: [0, -18, 0], y: [0, 18, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="flex min-h-[560px] flex-col justify-between rounded-[32px] bg-[#eef0eb]/92 p-6 sm:p-8">
            <div>
              <p className="text-sm font-medium text-[#68707d]">蒸馏车间</p>
              <h1 className="mt-4 max-w-[9ch] text-5xl font-semibold leading-[0.98] tracking-[-0.07em] text-[#171a1f] sm:text-6xl">
                用 nuwa 生成 Skill。
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#58616c]">
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
                  className="flex items-center justify-between rounded-[24px] bg-white/88 p-4 shadow-[0_12px_30px_rgb(28_34_24_/_0.06)]"
                  animate={reduce ? undefined : { y: [0, index % 2 ? 6 : -6, 0] }}
                  transition={{ duration: 3.2 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#171a1f]">{title}</p>
                    <p className="mt-1 text-xs text-[#78818d]">{copy}</p>
                  </div>
                  <Sparkle size={18} className="text-[#6f8f72]" />
                </motion.div>
              ))}
            </div>
          </div>

          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[32px] border border-black/[0.08] bg-white/90 p-5 shadow-[0_18px_50px_rgb(28_34_24_/_0.08)] sm:p-7"
          >
            <div className="flex items-center justify-between gap-4 border-b border-black/[0.07] pb-5">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-[20px] bg-[#dfeadc] text-[#44664d]">
                  <Flask size={21} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.035em] text-[#171a1f]">Nuwa Distillation</h2>
                  <p className="mt-1 text-xs text-[#7a8490]">异步生成 Agent Skill</p>
                </div>
              </div>
              <span className="rounded-full bg-[#f1f3ee] px-3 py-1 text-xs font-medium text-[#68707d]">Job</span>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2f343a]">人物</span>
                <input
                  value={targetName}
                  onChange={(event) => setTargetName(event.target.value)}
                  placeholder="例如：张小龙、段永平、彼得蒂尔"
                  className="h-13 rounded-[20px] border border-black/[0.08] bg-[#f7f8f5] px-4 text-sm text-[#171a1f] outline-none transition focus:border-[#8aaa82] focus:bg-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2f343a]">蒸馏目标</span>
                <textarea
                  value={inputBrief}
                  onChange={(event) => setInputBrief(event.target.value)}
                  placeholder="你希望学习他的哪类判断：产品、投资、组织、表达、人生选择..."
                  rows={5}
                  className="resize-none rounded-[22px] border border-black/[0.08] bg-[#f7f8f5] px-4 py-3 text-sm leading-6 text-[#171a1f] outline-none transition focus:border-[#8aaa82] focus:bg-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2f343a]">资料链接</span>
                <textarea
                  value={sourceURLs}
                  onChange={(event) => setSourceURLs(event.target.value)}
                  placeholder="每行一个公开资料链接。第一版会记录进任务，后续接入检索和上传资料。"
                  rows={3}
                  className="resize-none rounded-[22px] border border-black/[0.08] bg-[#f7f8f5] px-4 py-3 text-sm leading-6 text-[#171a1f] outline-none transition focus:border-[#8aaa82] focus:bg-white"
                />
              </label>
            </div>

            <div className="mt-5 rounded-[22px] bg-[#f6f3ea] px-4 py-3 text-xs leading-5 text-[#6d6250]">
              模型：{defaultProvider ? `${defaultProvider.provider_name} / ${defaultProvider.chat_model}` : "未配置，仍可创建任务，但真实蒸馏前需要 provider。"}
            </div>
            {(notice || error) && <p className="mt-4 text-sm text-[#68707d]">{error ?? notice}</p>}
            <button
              type="submit"
              disabled={busy || !token}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#171a1f] px-6 text-sm font-semibold text-white transition hover:bg-[#2a2f36] disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px"
            >
              {busy ? <ArrowClockwise size={16} className="animate-spin" /> : <ArrowRight size={15} />}
              {token ? "开始蒸馏" : "登录后蒸馏"}
            </button>
          </motion.form>
        </div>
      </div>

      <aside className="grid content-start gap-4">
        <div className="rounded-[34px] border border-black/[0.08] bg-white/82 p-5 shadow-[0_20px_60px_rgb(28_34_24_/_0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[#171a1f]">任务</h2>
            <button onClick={() => { void loadJobs(); void loadAgents(); }} className="grid size-9 place-items-center rounded-full bg-[#f1f3ee] text-[#59616b] transition hover:bg-[#e6eadf]" aria-label="刷新蒸馏任务">
              <ArrowClockwise size={16} />
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {jobs.length === 0 ? (
              <p className="rounded-[22px] bg-[#f7f8f5] p-4 text-sm text-[#68707d]">还没有蒸馏任务。</p>
            ) : jobs.map((job) => (
              <div key={job.id} className="rounded-[22px] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold tracking-[-0.025em] text-[#171a1f]">{job.target_name}</p>
                  {job.status === "completed" ? <CheckCircle size={18} className="text-[#5d8a63]" /> : job.status === "failed" ? <WarningCircle size={18} className="text-[#b25a48]" /> : <ArrowClockwise size={16} className="animate-spin text-[#7a8490]" />}
                </div>
                <p className="mt-2 text-xs font-medium text-[#68707d]">{statusText[job.status] ?? job.status}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#7a8490]">{job.error_message || job.progress_message}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
