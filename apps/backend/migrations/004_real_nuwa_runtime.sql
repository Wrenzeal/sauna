ALTER TABLE distillation_jobs
  ADD COLUMN IF NOT EXISTS result_system_prompt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS research_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_commit_sha text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS distillation_jobs_recovery_idx
  ON distillation_jobs(status, locked_at, created_at);

UPDATE distillation_jobs
SET status = 'published', published_at = COALESCE(completed_at, updated_at)
WHERE status = 'completed' AND result_agent_id IS NOT NULL;
