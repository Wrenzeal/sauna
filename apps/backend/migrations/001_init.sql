CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_user_idx ON workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  base_url text NOT NULL,
  api_key_ciphertext text NOT NULL,
  api_key_hint text NOT NULL DEFAULT '',
  chat_model text NOT NULL,
  embedding_model text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_configs_one_default_idx
  ON provider_configs(workspace_id)
  WHERE is_default;

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  slug text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '',
  role_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idle',
  is_public_template boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT agents_public_or_workspace CHECK (
    (is_public_template AND workspace_id IS NULL) OR ((NOT is_public_template) AND workspace_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_public_slug_idx
  ON agents(slug)
  WHERE is_public_template AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agents_workspace_slug_idx
  ON agents(workspace_id, slug)
  WHERE NOT is_public_template AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  system_prompt text NOT NULL,
  tone_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  distillation_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  skill_markdown text NOT NULL,
  expression_dna text NOT NULL DEFAULT '',
  mental_models text NOT NULL DEFAULT '',
  decision_heuristics text NOT NULL DEFAULT '',
  anti_patterns text NOT NULL DEFAULT '',
  honesty_boundaries text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version_no)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_current_version_fk'
  ) THEN
    ALTER TABLE agents
      ADD CONSTRAINT agents_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES agent_versions(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz,
  failed_reason text NOT NULL DEFAULT '',
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  knowledge_source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding_model text NOT NULL,
  embedding_dim integer NOT NULL DEFAULT 1536,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  title text NOT NULL,
  current_status text NOT NULL DEFAULT 'active',
  current_turn_id uuid,
  agent_id uuid NOT NULL REFERENCES agents(id),
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id),
  provider_config_id uuid NOT NULL REFERENCES provider_configs(id),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id),
  participant_role text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  interaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_message_id uuid,
  assistant_message_id uuid,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id uuid REFERENCES turns(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'complete',
  token_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turns_user_message_fk') THEN
    ALTER TABLE turns ADD CONSTRAINT turns_user_message_fk FOREIGN KEY (user_message_id) REFERENCES messages(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turns_assistant_message_fk') THEN
    ALTER TABLE turns ADD CONSTRAINT turns_assistant_message_fk FOREIGN KEY (assistant_message_id) REFERENCES messages(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(turn_id, sequence),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS sse_events_turn_sequence_idx ON sse_events(turn_id, sequence);
CREATE INDEX IF NOT EXISTS messages_session_created_idx ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, aggregate_type, aggregate_id, sequence)
);

CREATE TABLE IF NOT EXISTS agent_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  current_status text NOT NULL DEFAULT 'idle',
  current_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  last_seen_at timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
