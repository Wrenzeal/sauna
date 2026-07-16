CREATE TABLE IF NOT EXISTS catalog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  content_hash text NOT NULL DEFAULT '',
  source_description text NOT NULL DEFAULT '',
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_entries_status_sort_idx ON catalog_entries(status, featured DESC, sort_order, published_at DESC);
CREATE INDEX IF NOT EXISTS catalog_entries_categories_gin_idx ON catalog_entries USING gin(categories);

CREATE TABLE IF NOT EXISTS workspace_agent_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);
CREATE INDEX IF NOT EXISTS workspace_agent_subscriptions_workspace_idx ON workspace_agent_subscriptions(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS catalog_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_name text NOT NULL,
  normalized_name text NOT NULL,
  reason text NOT NULL DEFAULT '',
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  admin_note text NOT NULL DEFAULT '',
  linked_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  merged_into_id uuid REFERENCES catalog_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS catalog_requests_status_created_idx ON catalog_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_requests_normalized_active_idx ON catalog_requests(normalized_name, status);

CREATE TABLE IF NOT EXISTS catalog_request_followers (
  request_id uuid NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(request_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  linked_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_published_idx ON announcements(status, published_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  linked_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  linked_request_id uuid REFERENCES catalog_requests(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  text_body text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text NOT NULL DEFAULT '',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx ON notification_outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text NOT NULL,
  agent_id uuid NOT NULL REFERENCES agents(id),
  agent_version_id uuid NOT NULL REFERENCES agent_versions(id),
  title text NOT NULL,
  current_status text NOT NULL DEFAULT 'active',
  current_turn_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guest_sessions_device_expires_idx ON guest_sessions(device_hash, expires_at DESC);

CREATE TABLE IF NOT EXISTS guest_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  interaction_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_message_id uuid,
  assistant_message_id uuid,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  turn_id uuid REFERENCES guest_turns(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'complete',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guest_turns
  ADD CONSTRAINT guest_turns_user_message_fk FOREIGN KEY(user_message_id) REFERENCES guest_messages(id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT guest_turns_assistant_message_fk FOREIGN KEY(assistant_message_id) REFERENCES guest_messages(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE guest_sessions
  ADD CONSTRAINT guest_sessions_current_turn_fk FOREIGN KEY(current_turn_id) REFERENCES guest_turns(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS guest_sse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL REFERENCES guest_turns(id) ON DELETE CASCADE,
  event_id text NOT NULL UNIQUE,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(turn_id, sequence)
);

-- Backfill the current curated public people into the catalog.
INSERT INTO catalog_entries(agent_id, summary, categories, tags, featured, sort_order, content_hash, source_description, manifest)
SELECT a.id,
       CASE a.slug
         WHEN 'steve-jobs' THEN '从产品品味、聚焦与端到端体验出发审视问题。'
         WHEN 'elon-musk' THEN '用第一性原理、工程约束和极限目标拆解问题。'
         WHEN 'munger' THEN '用多元思维模型、逆向思考和长期主义辅助判断。'
         WHEN 'feynman' THEN '用清晰解释、实验精神和诚实求知检验理解。'
         WHEN 'naval' THEN '从杠杆、长期复利、判断力和自由出发思考。'
         WHEN 'paul-graham' THEN '从创业、写作、用户需求和独立思考出发判断。'
         ELSE a.role_summary
       END,
       CASE a.slug
         WHEN 'steve-jobs' THEN ARRAY['产品','设计']
         WHEN 'elon-musk' THEN ARRAY['工程','创业']
         WHEN 'munger' THEN ARRAY['投资','决策']
         WHEN 'feynman' THEN ARRAY['学习','科学']
         WHEN 'naval' THEN ARRAY['财富','人生']
         WHEN 'paul-graham' THEN ARRAY['创业','写作']
         ELSE ARRAY['综合']
       END,
       ARRAY[a.role_summary], true,
       CASE a.slug WHEN 'steve-jobs' THEN 10 WHEN 'elon-musk' THEN 20 WHEN 'munger' THEN 30 WHEN 'feynman' THEN 40 WHEN 'naval' THEN 50 WHEN 'paul-graham' THEN 60 ELSE 100 END,
       encode(digest(COALESCE(v.skill_markdown,''), 'sha256'), 'hex'),
       '由 Sauna 管理员使用 nuwa-skill 基于公开资料蒸馏并审核。',
       jsonb_build_object('schema_version', 1, 'seeded', true)
FROM agents a
JOIN agent_versions v ON v.id = a.current_version_id
WHERE a.is_public_template=true AND a.deleted_at IS NULL
ON CONFLICT(agent_id) DO NOTHING;

-- The product now uses subscriptions instead of private clones. This deletion is intentional and irreversible.
DELETE FROM distillation_jobs;
UPDATE sessions SET current_turn_id=NULL WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template);
UPDATE turns SET user_message_id=NULL, assistant_message_id=NULL WHERE session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
DELETE FROM sse_events WHERE session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
DELETE FROM turns WHERE session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
DELETE FROM session_participants WHERE session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
UPDATE agent_presence SET current_session_id=NULL WHERE current_session_id IN (SELECT id FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template));
DELETE FROM sessions WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template);
DELETE FROM agent_presence WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template);
DELETE FROM knowledge_sources WHERE agent_id IN (SELECT id FROM agents WHERE NOT is_public_template);
UPDATE agents SET current_version_id=NULL WHERE NOT is_public_template;
DELETE FROM agents WHERE NOT is_public_template;
