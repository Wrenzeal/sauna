ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS catalog_defaults_seeded_at timestamptz;

INSERT INTO workspace_agent_subscriptions(workspace_id, agent_id)
SELECT w.id, ce.agent_id
FROM workspaces w
JOIN catalog_entries ce ON ce.featured = true AND ce.status = 'published'
ON CONFLICT DO NOTHING;

UPDATE workspaces
SET catalog_defaults_seeded_at = COALESCE(catalog_defaults_seeded_at, now());
