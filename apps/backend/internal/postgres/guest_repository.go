package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"sauna/backend/internal/domain"
)

func (r *Repository) GetPublicAgentWithCurrentVersion(ctx context.Context, agentID string) (domain.AgentWithVersion, error) {
	var out domain.AgentWithVersion
	err := r.pool.QueryRow(ctx, `SELECT a.id::text,a.workspace_id::text,a.display_name,a.slug,a.avatar_emoji,a.role_summary,a.status,a.is_public_template,a.current_version_id::text,a.created_at,a.updated_at,v.id::text,v.agent_id::text,v.version_no,v.system_prompt,v.skill_markdown,v.expression_dna,v.mental_models,v.decision_heuristics,v.anti_patterns,v.honesty_boundaries,v.status,v.published_at,v.created_at,v.skill_source,v.skill_repo_url,v.skill_commit_sha,v.skill_metadata,v.quality_report FROM agents a JOIN catalog_entries ce ON ce.agent_id=a.id AND ce.status='published' JOIN agent_versions v ON v.id=a.current_version_id WHERE a.id=$1::uuid AND a.is_public_template=true AND a.deleted_at IS NULL`, agentID).Scan(&out.Agent.ID, &nullableStringScanner{dest: &out.Agent.WorkspaceID}, &out.Agent.DisplayName, &out.Agent.Slug, &out.Agent.AvatarEmoji, &out.Agent.RoleSummary, &out.Agent.Status, &out.Agent.IsPublicTemplate, &out.Agent.CurrentVersionID, &out.Agent.CreatedAt, &out.Agent.UpdatedAt, &out.Version.ID, &out.Version.AgentID, &out.Version.VersionNo, &out.Version.SystemPrompt, &out.Version.SkillMarkdown, &out.Version.ExpressionDNA, &out.Version.MentalModels, &out.Version.DecisionHeuristics, &out.Version.AntiPatterns, &out.Version.HonestyBoundaries, &out.Version.Status, &nullableTimeScanner{dest: &out.Version.PublishedAt}, &out.Version.CreatedAt, &out.Version.SkillSource, &out.Version.SkillRepoURL, &out.Version.SkillCommitSHA, &jsonBytesScanner{dest: &out.Version.SkillMetadata}, &jsonBytesScanner{dest: &out.Version.QualityReport})
	if err != nil {
		return domain.AgentWithVersion{}, mapErr(err)
	}
	return out, nil
}
func (r *Repository) StartGuestConsultation(ctx context.Context, deviceHash, agentID, title, content string, expiresAt time.Time) (domain.GuestTurnCreated, error) {
	agent, err := r.GetPublicAgentWithCurrentVersion(ctx, agentID)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	defer tx.Rollback(ctx)
	var result domain.GuestTurnCreated
	err = tx.QueryRow(ctx, `INSERT INTO guest_sessions(device_hash,agent_id,agent_version_id,title,expires_at) VALUES($1,$2::uuid,$3::uuid,$4,$5) RETURNING id::text,agent_id::text,agent_version_id::text,title,current_status,expires_at,created_at`, deviceHash, agent.Agent.ID, agent.Version.ID, title, expiresAt).Scan(&result.Session.ID, &result.Session.AgentID, &result.Session.AgentVersionID, &result.Session.Title, &result.Session.CurrentStatus, &result.Session.ExpiresAt, &result.Session.CreatedAt)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	if err = createGuestTurnTx(ctx, tx, &result, content); err != nil {
		return domain.GuestTurnCreated{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.GuestTurnCreated{}, err
	}
	return result, nil
}
func (r *Repository) CreateGuestTurn(ctx context.Context, deviceHash, sessionID, content string) (domain.GuestTurnCreated, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	defer tx.Rollback(ctx)
	var result domain.GuestTurnCreated
	err = tx.QueryRow(ctx, `SELECT id::text,agent_id::text,agent_version_id::text,title,current_status,expires_at,created_at FROM guest_sessions WHERE id=$1::uuid AND device_hash=$2 AND expires_at>now() FOR UPDATE`, sessionID, deviceHash).Scan(&result.Session.ID, &result.Session.AgentID, &result.Session.AgentVersionID, &result.Session.Title, &result.Session.CurrentStatus, &result.Session.ExpiresAt, &result.Session.CreatedAt)
	if err != nil {
		return domain.GuestTurnCreated{}, mapErr(err)
	}
	if err = createGuestTurnTx(ctx, tx, &result, content); err != nil {
		return domain.GuestTurnCreated{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.GuestTurnCreated{}, err
	}
	return result, nil
}
func createGuestTurnTx(ctx context.Context, tx pgx.Tx, result *domain.GuestTurnCreated, content string) error {
	var turn domain.Turn
	if err := tx.QueryRow(ctx, `INSERT INTO guest_turns(session_id,status) VALUES($1::uuid,'created') RETURNING id::text,''::text,session_id::text,interaction_id::text,''::text,''::text,status,created_at,updated_at`, result.Session.ID).Scan(&turn.ID, &turn.WorkspaceID, &turn.SessionID, &turn.InteractionID, &turn.UserMessageID, &turn.AssistantMessageID, &turn.Status, &turn.CreatedAt, &turn.UpdatedAt); err != nil {
		return err
	}
	var message domain.Message
	if err := tx.QueryRow(ctx, `INSERT INTO guest_messages(session_id,turn_id,agent_id,role,content,status) VALUES($1::uuid,$2::uuid,$3::uuid,'user',$4,'complete') RETURNING id::text,''::text,session_id::text,turn_id::text,agent_id::text,role,content,status,created_at`, result.Session.ID, turn.ID, result.Session.AgentID, content).Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE guest_turns SET user_message_id=$2::uuid,updated_at=now() WHERE id=$1::uuid`, turn.ID, message.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE guest_sessions SET current_turn_id=$2::uuid,updated_at=now() WHERE id=$1::uuid`, result.Session.ID, turn.ID); err != nil {
		return err
	}
	turn.UserMessageID = message.ID
	result.Turn = turn
	result.UserMessage = message
	return nil
}

func (r *Repository) GetGuestSession(ctx context.Context, deviceHash, sessionID string) (domain.GuestSession, error) {
	var s domain.GuestSession
	err := r.pool.QueryRow(ctx, `SELECT id::text,agent_id::text,agent_version_id::text,title,current_status,expires_at,created_at FROM guest_sessions WHERE id=$1::uuid AND device_hash=$2 AND expires_at>now()`, sessionID, deviceHash).Scan(&s.ID, &s.AgentID, &s.AgentVersionID, &s.Title, &s.CurrentStatus, &s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return domain.GuestSession{}, mapErr(err)
	}
	return s, nil
}
func (r *Repository) GetGuestTurn(ctx context.Context, deviceHash, sessionID, turnID string) (domain.Turn, error) {
	var t domain.Turn
	err := r.pool.QueryRow(ctx, `SELECT gt.id::text,''::text,gt.session_id::text,gt.interaction_id::text,gt.user_message_id::text,gt.assistant_message_id::text,gt.status,gt.created_at,gt.updated_at FROM guest_turns gt JOIN guest_sessions gs ON gs.id=gt.session_id WHERE gt.id=$3::uuid AND gt.session_id=$2::uuid AND gs.device_hash=$1 AND gs.expires_at>now()`, deviceHash, sessionID, turnID).Scan(&t.ID, &t.WorkspaceID, &t.SessionID, &t.InteractionID, &t.UserMessageID, &nullableStringValueScanner{dest: &t.AssistantMessageID}, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return domain.Turn{}, mapErr(err)
	}
	return t, nil
}
func (r *Repository) GetGuestMessage(ctx context.Context, deviceHash, messageID string) (domain.Message, error) {
	var m domain.Message
	err := r.pool.QueryRow(ctx, `SELECT gm.id::text,''::text,gm.session_id::text,COALESCE(gm.turn_id::text,''),gm.agent_id::text,gm.role,gm.content,gm.status,COALESCE(gm.metadata->>'error',''),gm.created_at FROM guest_messages gm JOIN guest_sessions gs ON gs.id=gm.session_id WHERE gm.id=$2::uuid AND gs.device_hash=$1 AND gs.expires_at>now()`, deviceHash, messageID).Scan(&m.ID, &m.WorkspaceID, &m.SessionID, &m.TurnID, &nullableStringScanner{dest: &m.AgentID}, &m.Role, &m.Content, &m.Status, &m.Error, &m.CreatedAt)
	if err != nil {
		return domain.Message{}, mapErr(err)
	}
	return m, nil
}
func (r *Repository) CreateGuestAssistantMessage(ctx context.Context, deviceHash, sessionID, turnID, agentID string) (domain.Message, error) {
	var m domain.Message
	err := r.pool.QueryRow(ctx, `INSERT INTO guest_messages(session_id,turn_id,agent_id,role,content,status) SELECT $2::uuid,$3::uuid,$4::uuid,'assistant','','pending' FROM guest_sessions WHERE id=$2::uuid AND device_hash=$1 AND expires_at>now() RETURNING id::text,''::text,session_id::text,turn_id::text,agent_id::text,role,content,status,created_at`, deviceHash, sessionID, turnID, agentID).Scan(&m.ID, &m.WorkspaceID, &m.SessionID, &m.TurnID, &nullableStringScanner{dest: &m.AgentID}, &m.Role, &m.Content, &m.Status, &m.CreatedAt)
	if err != nil {
		return domain.Message{}, mapErr(err)
	}
	return m, nil
}
func (r *Repository) SetGuestTurnAssistantMessage(ctx context.Context, deviceHash, turnID, messageID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE guest_turns gt SET assistant_message_id=$3::uuid,updated_at=now() FROM guest_sessions gs WHERE gt.id=$2::uuid AND gs.id=gt.session_id AND gs.device_hash=$1 AND gs.expires_at>now()`, deviceHash, turnID, messageID)
	return err
}
func (r *Repository) AppendGuestAssistantContent(ctx context.Context, deviceHash, messageID, delta, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE guest_messages gm SET content=content||$3,status=$4,updated_at=now() FROM guest_sessions gs WHERE gm.id=$2::uuid AND gs.id=gm.session_id AND gs.device_hash=$1 AND gs.expires_at>now()`, deviceHash, messageID, delta, status)
	return err
}
func (r *Repository) MarkGuestAssistantFailed(ctx context.Context, deviceHash, messageID, errorMessage string) error {
	_, err := r.pool.Exec(ctx, `UPDATE guest_messages gm SET status='failed',metadata=jsonb_set(metadata,'{error}',to_jsonb($3::text),true),updated_at=now() FROM guest_sessions gs WHERE gm.id=$2::uuid AND gs.id=gm.session_id AND gs.device_hash=$1`, deviceHash, messageID, errorMessage)
	return err
}
func (r *Repository) UpdateGuestTurnStatus(ctx context.Context, deviceHash, turnID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE guest_turns gt SET status=$3,updated_at=now() FROM guest_sessions gs WHERE gt.id=$2::uuid AND gs.id=gt.session_id AND gs.device_hash=$1`, deviceHash, turnID, status)
	return err
}
func (r *Repository) ListGuestMessages(ctx context.Context, deviceHash, sessionID string) ([]domain.Message, error) {
	return r.listGuestMessages(ctx, deviceHash, sessionID, 0)
}
func (r *Repository) ListRecentGuestMessages(ctx context.Context, deviceHash, sessionID string, limit int) ([]domain.Message, error) {
	return r.listGuestMessages(ctx, deviceHash, sessionID, limit)
}
func (r *Repository) listGuestMessages(ctx context.Context, deviceHash, sessionID string, limit int) ([]domain.Message, error) {
	query := `SELECT id::text,''::text,session_id::text,COALESCE(turn_id::text,''),agent_id::text,role,content,status,COALESCE(metadata->>'error',''),created_at FROM guest_messages WHERE session_id=$2::uuid AND EXISTS(SELECT 1 FROM guest_sessions gs WHERE gs.id=$2::uuid AND gs.device_hash=$1 AND gs.expires_at>now()) ORDER BY created_at ASC`
	args := []any{deviceHash, sessionID}
	if limit > 0 {
		query = `SELECT id::text,''::text,session_id::text,COALESCE(turn_id::text,''),agent_id::text,role,content,status,COALESCE(metadata->>'error',''),created_at FROM (SELECT gm.* FROM guest_messages gm JOIN guest_sessions gs ON gs.id=gm.session_id WHERE gm.session_id=$2::uuid AND gs.device_hash=$1 AND gs.expires_at>now() AND trim(gm.content)<>'' ORDER BY gm.created_at DESC LIMIT $3) recent ORDER BY created_at ASC`
		args = append(args, limit)
	}
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Message, 0)
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.ID, &m.WorkspaceID, &m.SessionID, &m.TurnID, &nullableStringScanner{dest: &m.AgentID}, &m.Role, &m.Content, &m.Status, &m.Error, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (r *Repository) NextGuestSSESequence(ctx context.Context, turnID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COALESCE(max(sequence),0)+1 FROM guest_sse_events WHERE turn_id=$1::uuid`, turnID).Scan(&n)
	return n, err
}
func (r *Repository) InsertGuestSSEEvent(ctx context.Context, deviceHash, sessionID, turnID, eventID string, sequence int, eventType string, payload []byte) (domain.SSEEvent, error) {
	var e domain.SSEEvent
	err := r.pool.QueryRow(ctx, `INSERT INTO guest_sse_events(session_id,turn_id,event_id,sequence,event_type,payload) SELECT $2::uuid,$3::uuid,$4,$5,$6,$7::jsonb FROM guest_sessions WHERE id=$2::uuid AND device_hash=$1 RETURNING id::text,event_id,sequence,event_type,payload::text,created_at`, deviceHash, sessionID, turnID, eventID, sequence, eventType, payload).Scan(&e.ID, &e.EventID, &e.Sequence, &e.EventType, &jsonBytesScanner{dest: &e.Payload}, &e.CreatedAt)
	if err != nil {
		return domain.SSEEvent{}, err
	}
	return e, nil
}
func (r *Repository) ListGuestSSEEventsAfter(ctx context.Context, deviceHash, turnID string, after int) ([]domain.SSEEvent, error) {
	rows, err := r.pool.Query(ctx, `SELECT ge.id::text,ge.event_id,ge.sequence,ge.event_type,ge.payload::text,ge.created_at FROM guest_sse_events ge JOIN guest_sessions gs ON gs.id=ge.session_id WHERE ge.turn_id=$2::uuid AND ge.sequence>$3 AND gs.device_hash=$1 AND gs.expires_at>now() ORDER BY ge.sequence`, deviceHash, turnID, after)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.SSEEvent, 0)
	for rows.Next() {
		var e domain.SSEEvent
		if err := rows.Scan(&e.ID, &e.EventID, &e.Sequence, &e.EventType, &jsonBytesScanner{dest: &e.Payload}, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
func (r *Repository) DeleteExpiredGuestSessions(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM guest_sessions WHERE expires_at<=now()`)
	return err
}
