ALTER TABLE agent_versions
  ADD COLUMN IF NOT EXISTS skill_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS skill_repo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS skill_commit_sha text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS skill_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_report jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS distillation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_name text NOT NULL,
  target_type text NOT NULL DEFAULT 'person',
  input_brief text NOT NULL DEFAULT '',
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_config_id uuid REFERENCES provider_configs(id),
  status text NOT NULL DEFAULT 'queued',
  progress_message text NOT NULL DEFAULT '',
  result_agent_id uuid REFERENCES agents(id),
  result_skill_markdown text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS distillation_jobs_workspace_created_idx
  ON distillation_jobs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS distillation_jobs_status_created_idx
  ON distillation_jobs(status, created_at ASC);

UPDATE agent_versions v
SET skill_source = 'nuwa_prebuilt',
    skill_repo_url = 'https://github.com/alchaincyf/nuwa-skill',
    skill_metadata = jsonb_build_object('imported_from', 'nuwa-skill examples')
FROM agents a
WHERE a.id = v.agent_id
  AND a.is_public_template = true
  AND a.slug IN ('steve-jobs', 'elon-musk', 'munger', 'feynman', 'naval', 'paul-graham');

UPDATE agents
SET deleted_at = now(), updated_at = now()
WHERE is_public_template = true
  AND slug IN ('bill-gates', 'shou-zi-chew')
  AND deleted_at IS NULL;
