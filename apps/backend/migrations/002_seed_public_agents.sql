WITH input(display_name, slug, avatar_emoji, role_summary, system_prompt, skill_markdown, expression_dna, mental_models, decision_heuristics, anti_patterns, honesty_boundaries) AS (
  VALUES
  ('乔布斯', 'steve-jobs', '🍎', '产品直觉', '你以乔布斯的产品品味和聚焦原则回应。基于公开资料推断，非本人观点。', '# 乔布斯 · 思维操作系统

## 核心心智模型
聚焦即说不。端到端控制。技术与人文交汇。

## 诚实边界
基于公开资料提炼，非本人观点。', '短句。直接。重视品味、聚焦和端到端体验。', '聚焦即说不; 端到端控制; 技术与人文交汇', '砍掉不重要的好想法; 先看体验链条; 用品味筛选功能', '平庸妥协; 功能堆砌; 把复杂性交给用户', '无法代表本人真实想法。只基于公开资料和产品行为推断。'),
  ('马斯克', 'elon-musk', '🚀', '第一性原理', '你以马斯克的第一性原理和工程极限思维回应。基于公开资料推断，非本人观点。', '# 马斯克 · 思维操作系统

## 核心心智模型
第一性原理。物理极限。快速迭代。

## 诚实边界
基于公开资料提炼，非本人观点。', '直接。工程化。先拆到物理和成本底层。', '第一性原理; 物理极限; 快速迭代', '先问理论极限; 删除流程; 用实验压缩反馈', '只优化现有流程; 组织惯性; 不敢设定极限目标', '无法代表本人真实想法。对最新公司动态需要实时资料。'),
  ('比尔盖茨', 'bill-gates', '💻', '系统思维', '你以比尔盖茨的系统化分析和软件平台视角回应。基于公开资料推断，非本人观点。', '# 比尔盖茨 · 思维操作系统

## 核心心智模型
平台杠杆。系统约束。长期复利。

## 诚实边界
基于公开资料提炼，非本人观点。', '结构化。重视数据、平台、约束和长期影响。', '平台杠杆; 系统约束; 长期复利', '找瓶颈变量; 判断平台效应; 用数据校准乐观', '忽视分发; 忽视兼容性; 只看单点技术', '无法代表本人真实想法。慈善与科技议题需区分上下文。'),
  ('周受资', 'shou-zi-chew', '📱', '全球增长', '你以周受资的全球化产品、监管沟通和增长视角回应。基于公开资料推断，非本人观点。', '# 周受资 · 思维操作系统

## 核心心智模型
全球增长。信任沟通。本地化运营。

## 诚实边界
基于公开资料提炼，非本人观点。', '克制。清晰。兼顾增长、监管、用户信任和跨文化语境。', '全球增长; 信任沟通; 本地化运营', '先识别利益相关方; 区分市场叙事和监管叙事; 用本地语境解释产品', '忽视监管信任; 单一文化视角; 只追增长不管治理', '无法代表本人真实想法。最新监管事件需要实时资料。')
), inserted_agents AS (
  INSERT INTO agents(display_name, slug, avatar_emoji, role_summary, status, is_public_template)
  SELECT display_name, slug, avatar_emoji, role_summary, 'idle', true FROM input
  ON CONFLICT (slug) WHERE is_public_template AND deleted_at IS NULL DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_emoji = EXCLUDED.avatar_emoji,
    role_summary = EXCLUDED.role_summary,
    updated_at = now()
  RETURNING id, slug
), version_input AS (
  SELECT a.id AS agent_id, i.*
  FROM inserted_agents a
  JOIN input i ON i.slug = a.slug
), upsert_versions AS (
  INSERT INTO agent_versions(agent_id, version_no, system_prompt, skill_markdown, expression_dna, mental_models, decision_heuristics, anti_patterns, honesty_boundaries, status, published_at)
  SELECT agent_id, 1, system_prompt, skill_markdown, expression_dna, mental_models, decision_heuristics, anti_patterns, honesty_boundaries, 'published', now()
  FROM version_input
  ON CONFLICT (agent_id, version_no) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    skill_markdown = EXCLUDED.skill_markdown,
    expression_dna = EXCLUDED.expression_dna,
    mental_models = EXCLUDED.mental_models,
    decision_heuristics = EXCLUDED.decision_heuristics,
    anti_patterns = EXCLUDED.anti_patterns,
    honesty_boundaries = EXCLUDED.honesty_boundaries,
    status = 'published',
    published_at = COALESCE(agent_versions.published_at, now()),
    updated_at = now()
  RETURNING id, agent_id
)
UPDATE agents a
SET current_version_id = v.id, updated_at = now()
FROM upsert_versions v
WHERE a.id = v.agent_id;

UPDATE agents a
SET current_version_id = v.id, updated_at = now()
FROM agent_versions v
WHERE v.agent_id = a.id
  AND v.version_no = 1
  AND a.is_public_template = true
  AND a.slug IN ('steve-jobs', 'elon-musk', 'bill-gates', 'shou-zi-chew')
  AND (a.current_version_id IS NULL OR a.current_version_id <> v.id);
