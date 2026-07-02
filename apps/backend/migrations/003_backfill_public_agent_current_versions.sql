UPDATE agents a
SET current_version_id = v.id, updated_at = now()
FROM agent_versions v
WHERE v.agent_id = a.id
  AND v.version_no = 1
  AND a.is_public_template = true
  AND a.slug IN ('steve-jobs', 'elon-musk', 'bill-gates', 'shou-zi-chew')
  AND (a.current_version_id IS NULL OR a.current_version_id <> v.id);
