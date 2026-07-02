package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"sauna/backend/internal/domain"
	"sauna/backend/internal/service"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) UpsertUserWorkspace(ctx context.Context, email string) (domain.AuthIdentity, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AuthIdentity{}, err
	}
	defer tx.Rollback(ctx)

	var user domain.User
	if err := tx.QueryRow(ctx, `
		INSERT INTO users(email, display_name)
		VALUES($1, $2)
		ON CONFLICT(email) DO UPDATE SET updated_at = now()
		RETURNING id::text, email, display_name, created_at
	`, email, displayName(email)).Scan(&user.ID, &user.Email, &user.DisplayName, &user.CreatedAt); err != nil {
		return domain.AuthIdentity{}, err
	}
	var workspace domain.Workspace
	if err := tx.QueryRow(ctx, `
		INSERT INTO workspaces(owner_user_id, name)
		VALUES($1::uuid, $2)
		ON CONFLICT (owner_user_id) DO UPDATE SET updated_at = now()
		RETURNING id::text, owner_user_id::text, name, created_at
	`, user.ID, workspaceName(email)).Scan(&workspace.ID, &workspace.OwnerUserID, &workspace.Name, &workspace.CreatedAt); err != nil {
		return domain.AuthIdentity{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AuthIdentity{}, err
	}
	return domain.AuthIdentity{User: user, Workspace: workspace}, nil
}

func (r *Repository) CreateAuthSession(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO auth_sessions(user_id, token_hash, expires_at)
		VALUES($1::uuid, $2, $3)
	`, userID, tokenHash, expiresAt)
	return err
}

func (r *Repository) GetIdentityByTokenHash(ctx context.Context, tokenHash string) (domain.AuthIdentity, error) {
	var identity domain.AuthIdentity
	err := r.pool.QueryRow(ctx, `
		SELECT u.id::text, u.email, u.display_name, u.created_at,
		       w.id::text, w.owner_user_id::text, w.name, w.created_at
		FROM auth_sessions s
		JOIN users u ON u.id = s.user_id
		JOIN workspaces w ON w.owner_user_id = u.id
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
	`, tokenHash).Scan(
		&identity.User.ID, &identity.User.Email, &identity.User.DisplayName, &identity.User.CreatedAt,
		&identity.Workspace.ID, &identity.Workspace.OwnerUserID, &identity.Workspace.Name, &identity.Workspace.CreatedAt,
	)
	if err != nil {
		return domain.AuthIdentity{}, mapErr(err)
	}
	return identity, nil
}

func (r *Repository) RevokeAuthSession(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1`, tokenHash)
	return err
}

func (r *Repository) CreateProviderConfig(ctx context.Context, input service.CreateProviderInput) (domain.ProviderConfig, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ProviderConfig{}, err
	}
	defer tx.Rollback(ctx)
	if input.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE provider_configs SET is_default=false, updated_at=now() WHERE workspace_id=$1::uuid`, input.WorkspaceID); err != nil {
			return domain.ProviderConfig{}, err
		}
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM provider_configs WHERE workspace_id=$1::uuid AND status <> 'deleted'`, input.WorkspaceID).Scan(&count); err != nil {
		return domain.ProviderConfig{}, err
	}
	isDefault := input.IsDefault || count == 0
	var provider domain.ProviderConfig
	if err := tx.QueryRow(ctx, `
		INSERT INTO provider_configs(workspace_id, provider_name, base_url, api_key_ciphertext, api_key_hint, chat_model, embedding_model, is_default)
		VALUES($1::uuid, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at
	`, input.WorkspaceID, input.ProviderName, input.BaseURL, input.APIKeyCiphertext, input.APIKeyHint, input.ChatModel, input.EmbeddingModel, isDefault).Scan(
		&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt,
	); err != nil {
		return domain.ProviderConfig{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ProviderConfig{}, err
	}
	return provider, nil
}

func (r *Repository) ListProviderConfigs(ctx context.Context, workspaceID string) ([]domain.ProviderConfig, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at
		FROM provider_configs
		WHERE workspace_id=$1::uuid AND status <> 'deleted'
		ORDER BY is_default DESC, created_at DESC
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	providers := make([]domain.ProviderConfig, 0)
	for rows.Next() {
		var provider domain.ProviderConfig
		if err := rows.Scan(&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt); err != nil {
			return nil, err
		}
		providers = append(providers, provider)
	}
	return providers, rows.Err()
}

func (r *Repository) UpdateProviderConfig(ctx context.Context, input service.UpdateProviderInput) (domain.ProviderConfig, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ProviderConfig{}, err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM provider_configs WHERE workspace_id=$1::uuid AND id=$2::uuid AND status <> 'deleted')`, input.WorkspaceID, input.ProviderConfigID).Scan(&exists); err != nil {
		return domain.ProviderConfig{}, err
	}
	if !exists {
		return domain.ProviderConfig{}, domain.ErrNotFound
	}
	if input.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE provider_configs SET is_default=false, updated_at=now() WHERE workspace_id=$1::uuid`, input.WorkspaceID); err != nil {
			return domain.ProviderConfig{}, err
		}
	}
	apiKeyCiphertextSQL := `api_key_ciphertext`
	apiKeyHintSQL := `api_key_hint`
	args := []any{input.WorkspaceID, input.ProviderConfigID, input.ProviderName, input.BaseURL, input.ChatModel, input.EmbeddingModel, input.IsDefault}
	if input.APIKeyCiphertext != nil && input.APIKeyHint != nil {
		apiKeyCiphertextSQL = `$8`
		apiKeyHintSQL = `$9`
		args = append(args, *input.APIKeyCiphertext, *input.APIKeyHint)
	}
	var provider domain.ProviderConfig
	query := fmt.Sprintf(`
		UPDATE provider_configs
		SET provider_name=$3, base_url=$4, chat_model=$5, embedding_model=$6,
		    is_default=$7, api_key_ciphertext=%s, api_key_hint=%s, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid AND status <> 'deleted'
		RETURNING id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at
	`, apiKeyCiphertextSQL, apiKeyHintSQL)
	if err := tx.QueryRow(ctx, query, args...).Scan(&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt); err != nil {
		return domain.ProviderConfig{}, mapErr(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ProviderConfig{}, err
	}
	return provider, nil
}

func (r *Repository) DeleteProviderConfig(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ProviderConfig{}, err
	}
	defer tx.Rollback(ctx)
	var provider domain.ProviderConfig
	if err := tx.QueryRow(ctx, `
		UPDATE provider_configs SET status='deleted', is_default=false, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid AND status <> 'deleted'
		RETURNING id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at
	`, workspaceID, providerConfigID).Scan(&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt); err != nil {
		return domain.ProviderConfig{}, mapErr(err)
	}
	var remainingDefault bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM provider_configs WHERE workspace_id=$1::uuid AND status <> 'deleted' AND is_default=true)`, workspaceID).Scan(&remainingDefault); err != nil {
		return domain.ProviderConfig{}, err
	}
	if !remainingDefault {
		if _, err := tx.Exec(ctx, `
			UPDATE provider_configs SET is_default=true, updated_at=now()
			WHERE id = (
				SELECT id FROM provider_configs
				WHERE workspace_id=$1::uuid AND status <> 'deleted'
				ORDER BY created_at DESC
				LIMIT 1
			)
		`, workspaceID); err != nil {
			return domain.ProviderConfig{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ProviderConfig{}, err
	}
	return provider, nil
}

func (r *Repository) GetProviderSecret(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderSecret, error) {
	var provider domain.ProviderSecret
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at, api_key_ciphertext
		FROM provider_configs
		WHERE workspace_id=$1::uuid AND id=$2::uuid AND status <> 'deleted'
	`, workspaceID, providerConfigID).Scan(
		&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt, &provider.APIKeyCiphertext,
	)
	if err != nil {
		return domain.ProviderSecret{}, mapErr(err)
	}
	return provider, nil
}

func (r *Repository) GetDefaultProviderSecret(ctx context.Context, workspaceID string) (domain.ProviderSecret, error) {
	var provider domain.ProviderSecret
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at, api_key_ciphertext
		FROM provider_configs
		WHERE workspace_id=$1::uuid AND is_default=true AND status <> 'deleted'
	`, workspaceID).Scan(
		&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt, &provider.APIKeyCiphertext,
	)
	if err != nil {
		return domain.ProviderSecret{}, mapErr(err)
	}
	return provider, nil
}

func (r *Repository) SetDefaultProviderConfig(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ProviderConfig{}, err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM provider_configs WHERE workspace_id=$1::uuid AND id=$2::uuid AND status <> 'deleted')`, workspaceID, providerConfigID).Scan(&exists); err != nil {
		return domain.ProviderConfig{}, err
	}
	if !exists {
		return domain.ProviderConfig{}, domain.ErrNotFound
	}
	if _, err := tx.Exec(ctx, `UPDATE provider_configs SET is_default=false, updated_at=now() WHERE workspace_id=$1::uuid`, workspaceID); err != nil {
		return domain.ProviderConfig{}, err
	}
	var provider domain.ProviderConfig
	if err := tx.QueryRow(ctx, `
		UPDATE provider_configs SET is_default=true, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid
		RETURNING id::text, workspace_id::text, provider_name, base_url, chat_model, embedding_model, api_key_hint, is_default, status, created_at, updated_at, last_tested_at
	`, workspaceID, providerConfigID).Scan(&provider.ID, &provider.WorkspaceID, &provider.ProviderName, &provider.BaseURL, &provider.ChatModel, &provider.EmbeddingModel, &provider.MaskedAPIKey, &provider.IsDefault, &provider.Status, &provider.CreatedAt, &provider.UpdatedAt, &provider.LastTestedAt); err != nil {
		return domain.ProviderConfig{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ProviderConfig{}, err
	}
	return provider, nil
}

func (r *Repository) MarkProviderTested(ctx context.Context, workspaceID string, providerConfigID string, status string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE provider_configs SET status=$3, last_tested_at=now(), updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, providerConfigID, status)
	return err
}

func (r *Repository) ListPublicAgents(ctx context.Context) ([]domain.Agent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, display_name, slug, avatar_emoji, role_summary, status, is_public_template, COALESCE(current_version_id::text, ''), created_at, updated_at
		FROM agents
		WHERE is_public_template=true AND deleted_at IS NULL
		ORDER BY CASE slug
		  WHEN 'steve-jobs' THEN 1
		  WHEN 'elon-musk' THEN 2
		  WHEN 'bill-gates' THEN 3
		  WHEN 'munger' THEN 3
		  WHEN 'feynman' THEN 4
		  WHEN 'naval' THEN 5
		  WHEN 'paul-graham' THEN 6
		  ELSE 99
		END, created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := make([]domain.Agent, 0)
	for rows.Next() {
		agent, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, rows.Err()
}

func (r *Repository) GetAgentWithCurrentVersion(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error) {
	var output domain.AgentWithVersion
	err := r.pool.QueryRow(ctx, `
		SELECT a.id::text, a.workspace_id::text, a.display_name, a.slug, a.avatar_emoji, a.role_summary, a.status, a.is_public_template, a.current_version_id::text, a.created_at, a.updated_at,
		       v.id::text, v.agent_id::text, v.version_no, v.system_prompt, v.skill_markdown, v.expression_dna, v.mental_models, v.decision_heuristics, v.anti_patterns, v.honesty_boundaries, v.status, v.published_at, v.created_at, v.skill_source, v.skill_repo_url, v.skill_commit_sha, v.skill_metadata, v.quality_report
		FROM agents a
		JOIN agent_versions v ON v.id = a.current_version_id
		WHERE a.id=$2::uuid AND a.deleted_at IS NULL
		  AND (a.is_public_template=true OR a.workspace_id=$1::uuid)
	`, workspaceID, agentID).Scan(
		&output.Agent.ID, &nullableStringScanner{dest: &output.Agent.WorkspaceID}, &output.Agent.DisplayName, &output.Agent.Slug, &output.Agent.AvatarEmoji, &output.Agent.RoleSummary, &output.Agent.Status, &output.Agent.IsPublicTemplate, &output.Agent.CurrentVersionID, &output.Agent.CreatedAt, &output.Agent.UpdatedAt,
		&output.Version.ID, &output.Version.AgentID, &output.Version.VersionNo, &output.Version.SystemPrompt, &output.Version.SkillMarkdown, &output.Version.ExpressionDNA, &output.Version.MentalModels, &output.Version.DecisionHeuristics, &output.Version.AntiPatterns, &output.Version.HonestyBoundaries, &output.Version.Status, &nullableTimeScanner{dest: &output.Version.PublishedAt}, &output.Version.CreatedAt, &output.Version.SkillSource, &output.Version.SkillRepoURL, &output.Version.SkillCommitSHA, &jsonBytesScanner{dest: &output.Version.SkillMetadata}, &jsonBytesScanner{dest: &output.Version.QualityReport},
	)
	if err != nil {
		return domain.AgentWithVersion{}, mapErr(err)
	}
	return output, nil
}

func (r *Repository) ClonePublicAgent(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error) {
	source, err := r.GetAgentWithCurrentVersion(ctx, workspaceID, agentID)
	if err != nil {
		return domain.AgentWithVersion{}, err
	}
	if !source.Agent.IsPublicTemplate {
		return domain.AgentWithVersion{}, domain.ErrInvalidInput
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AgentWithVersion{}, err
	}
	defer tx.Rollback(ctx)
	cloneSlug := source.Agent.Slug
	var cloneID string
	err = tx.QueryRow(ctx, `
		INSERT INTO agents(workspace_id, display_name, slug, avatar_emoji, role_summary, status, is_public_template)
		VALUES($1::uuid, $2, $3, $4, $5, 'idle', false)
		ON CONFLICT (workspace_id, slug) WHERE NOT is_public_template AND deleted_at IS NULL DO UPDATE SET updated_at=now()
		RETURNING id::text
	`, workspaceID, source.Agent.DisplayName, cloneSlug, source.Agent.AvatarEmoji, source.Agent.RoleSummary).Scan(&cloneID)
	if err != nil {
		return domain.AgentWithVersion{}, err
	}
	var versionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO agent_versions(agent_id, version_no, system_prompt, skill_markdown, expression_dna, mental_models, decision_heuristics, anti_patterns, honesty_boundaries, status, published_at)
		VALUES($1::uuid, 1, $2, $3, $4, $5, $6, $7, $8, 'published', now())
		ON CONFLICT(agent_id, version_no) DO UPDATE SET updated_at=now()
		RETURNING id::text
	`, cloneID, source.Version.SystemPrompt, source.Version.SkillMarkdown, source.Version.ExpressionDNA, source.Version.MentalModels, source.Version.DecisionHeuristics, source.Version.AntiPatterns, source.Version.HonestyBoundaries).Scan(&versionID)
	if err != nil {
		return domain.AgentWithVersion{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE agents SET current_version_id=$2::uuid, updated_at=now() WHERE id=$1::uuid`, cloneID, versionID); err != nil {
		return domain.AgentWithVersion{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AgentWithVersion{}, err
	}
	return r.GetAgentWithCurrentVersion(ctx, workspaceID, cloneID)
}

func (r *Repository) CreateFocusSession(ctx context.Context, workspaceID string, agentID string, providerConfigID string, title string) (domain.Session, error) {
	agent, err := r.GetAgentWithCurrentVersion(ctx, workspaceID, agentID)
	if err != nil {
		return domain.Session{}, err
	}
	var session domain.Session
	err = r.pool.QueryRow(ctx, `
		INSERT INTO sessions(workspace_id, session_type, title, agent_id, agent_version_id, provider_config_id)
		VALUES($1::uuid, $2, $3, $4::uuid, $5::uuid, $6::uuid)
		RETURNING id::text, workspace_id::text, session_type, title, current_status, agent_id::text, agent_version_id::text, provider_config_id::text, created_at, updated_at
	`, workspaceID, domain.SessionTypeFocus, title, agent.Agent.ID, agent.Version.ID, providerConfigID).Scan(
		&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus, &session.AgentID, &session.AgentVersionID, &session.ProviderConfigID, &session.CreatedAt, &session.UpdatedAt,
	)
	if err != nil {
		return domain.Session{}, err
	}
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO session_participants(workspace_id, session_id, agent_id, participant_role, order_index)
		VALUES($1::uuid, $2::uuid, $3::uuid, 'advisor', 0)
	`, workspaceID, session.ID, agent.Agent.ID)
	return session, nil
}

func (r *Repository) StartConsultation(ctx context.Context, workspaceID string, agentID string, providerConfigID string, title string, content string) (domain.ConsultationStarted, error) {
	agent, err := r.GetAgentWithCurrentVersion(ctx, workspaceID, agentID)
	if err != nil {
		return domain.ConsultationStarted{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ConsultationStarted{}, err
	}
	defer tx.Rollback(ctx)

	var session domain.Session
	if err := tx.QueryRow(ctx, `
		INSERT INTO sessions(workspace_id, session_type, title, agent_id, agent_version_id, provider_config_id, current_status, last_activity_at)
		VALUES($1::uuid, $2, $3, $4::uuid, $5::uuid, $6::uuid, 'active', now())
		RETURNING id::text, workspace_id::text, session_type, title, current_status, agent_id::text, agent_version_id::text, provider_config_id::text, created_at, updated_at
	`, workspaceID, domain.SessionTypeFocus, title, agent.Agent.ID, agent.Version.ID, providerConfigID).Scan(
		&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus, &session.AgentID, &session.AgentVersionID, &session.ProviderConfigID, &session.CreatedAt, &session.UpdatedAt,
	); err != nil {
		return domain.ConsultationStarted{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO session_participants(workspace_id, session_id, agent_id, participant_role, order_index)
		VALUES($1::uuid, $2::uuid, $3::uuid, 'advisor', 0)
	`, workspaceID, session.ID, agent.Agent.ID); err != nil {
		return domain.ConsultationStarted{}, err
	}
	var turn domain.Turn
	if err := tx.QueryRow(ctx, `
		INSERT INTO turns(workspace_id, session_id, status)
		VALUES($1::uuid, $2::uuid, $3)
		RETURNING id::text, workspace_id::text, session_id::text, interaction_id::text, COALESCE(user_message_id::text, ''), assistant_message_id::text, status, created_at, updated_at
	`, workspaceID, session.ID, domain.TurnStatusCreated).Scan(&turn.ID, &turn.WorkspaceID, &turn.SessionID, &turn.InteractionID, &turn.UserMessageID, &nullableStringValueScanner{dest: &turn.AssistantMessageID}, &turn.Status, &turn.CreatedAt, &turn.UpdatedAt); err != nil {
		return domain.ConsultationStarted{}, err
	}
	var message domain.Message
	if err := tx.QueryRow(ctx, `
		INSERT INTO messages(workspace_id, session_id, turn_id, role, content, status)
		VALUES($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
		RETURNING id::text, workspace_id::text, session_id::text, turn_id::text, agent_id::text, role, content, status, created_at
	`, workspaceID, session.ID, turn.ID, domain.MessageRoleUser, content, domain.MessageStatusDone).Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt); err != nil {
		return domain.ConsultationStarted{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE turns SET user_message_id=$2::uuid, updated_at=now() WHERE id=$1::uuid`, turn.ID, message.ID); err != nil {
		return domain.ConsultationStarted{}, err
	}
	turn.UserMessageID = message.ID
	if _, err := tx.Exec(ctx, `UPDATE sessions SET current_turn_id=$2::uuid, last_activity_at=now(), updated_at=now() WHERE id=$1::uuid`, session.ID, turn.ID); err != nil {
		return domain.ConsultationStarted{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ConsultationStarted{}, err
	}
	return domain.ConsultationStarted{Session: session, Turn: turn, UserMessage: message}, nil
}

func (r *Repository) ListFocusSessions(ctx context.Context, workspaceID string) ([]domain.FocusSessionSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT s.id::text, s.workspace_id::text, s.session_type, s.title, s.current_status,
		       s.agent_id::text, a.display_name, a.avatar_emoji,
		       COALESCE(last_msg.content, '') AS last_message_preview,
		       s.last_activity_at, s.created_at, s.updated_at
		FROM sessions s
		JOIN agents a ON a.id = s.agent_id
		LEFT JOIN LATERAL (
			SELECT content
			FROM messages m
			WHERE m.workspace_id = s.workspace_id AND m.session_id = s.id AND trim(m.content) <> ''
			ORDER BY m.created_at DESC
			LIMIT 1
		) last_msg ON true
		WHERE s.workspace_id=$1::uuid AND s.session_type=$2
		  AND EXISTS (
			SELECT 1 FROM messages user_msg
			WHERE user_msg.workspace_id = s.workspace_id
			  AND user_msg.session_id = s.id
			  AND user_msg.role = 'user'
			  AND trim(user_msg.content) <> ''
		  )
		ORDER BY s.last_activity_at DESC, s.created_at DESC
		LIMIT 50
	`, workspaceID, domain.SessionTypeFocus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sessions := make([]domain.FocusSessionSummary, 0)
	for rows.Next() {
		var session domain.FocusSessionSummary
		if err := rows.Scan(
			&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus,
			&session.AgentID, &session.AgentDisplayName, &session.AgentAvatarEmoji, &session.LastMessagePreview,
			&session.LastActivityAt, &session.CreatedAt, &session.UpdatedAt,
		); err != nil {
			return nil, err
		}
		session.LastMessagePreview = compactPreview(session.LastMessagePreview, 96)
		sessions = append(sessions, session)
	}
	return sessions, rows.Err()
}

func (r *Repository) GetSession(ctx context.Context, workspaceID string, sessionID string) (domain.Session, error) {
	var session domain.Session
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, session_type, title, current_status, agent_id::text, agent_version_id::text, provider_config_id::text, created_at, updated_at
		FROM sessions WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, sessionID).Scan(&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus, &session.AgentID, &session.AgentVersionID, &session.ProviderConfigID, &session.CreatedAt, &session.UpdatedAt)
	if err != nil {
		return domain.Session{}, mapErr(err)
	}
	return session, nil
}

func (r *Repository) RenameSession(ctx context.Context, workspaceID string, sessionID string, title string) (domain.Session, error) {
	var session domain.Session
	err := r.pool.QueryRow(ctx, `
		UPDATE sessions
		SET title=$3, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid AND session_type=$4
		RETURNING id::text, workspace_id::text, session_type, title, current_status, agent_id::text, agent_version_id::text, provider_config_id::text, created_at, updated_at
	`, workspaceID, sessionID, title, domain.SessionTypeFocus).Scan(&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus, &session.AgentID, &session.AgentVersionID, &session.ProviderConfigID, &session.CreatedAt, &session.UpdatedAt)
	if err != nil {
		return domain.Session{}, mapErr(err)
	}
	return session, nil
}

func (r *Repository) DeleteSession(ctx context.Context, workspaceID string, sessionID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sessions WHERE workspace_id=$1::uuid AND id=$2::uuid AND session_type=$3)`, workspaceID, sessionID, domain.SessionTypeFocus).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return domain.ErrNotFound
	}
	if _, err := tx.Exec(ctx, `UPDATE sessions SET current_turn_id=NULL WHERE workspace_id=$1::uuid AND id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE turns SET user_message_id=NULL, assistant_message_id=NULL WHERE workspace_id=$1::uuid AND session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM sse_events WHERE workspace_id=$1::uuid AND session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM messages WHERE workspace_id=$1::uuid AND session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM turns WHERE workspace_id=$1::uuid AND session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM session_participants WHERE workspace_id=$1::uuid AND session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE agent_presence SET current_session_id=NULL WHERE workspace_id=$1::uuid AND current_session_id=$2::uuid`, workspaceID, sessionID); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `DELETE FROM sessions WHERE workspace_id=$1::uuid AND id=$2::uuid AND session_type=$3`, workspaceID, sessionID, domain.SessionTypeFocus)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return tx.Commit(ctx)
}

func (r *Repository) CreateTurn(ctx context.Context, workspaceID string, sessionID string, content string) (domain.TurnCreated, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.TurnCreated{}, err
	}
	defer tx.Rollback(ctx)
	var session domain.Session
	if err := tx.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, session_type, title, current_status, agent_id::text, agent_version_id::text, provider_config_id::text, created_at, updated_at
		FROM sessions WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, sessionID).Scan(&session.ID, &session.WorkspaceID, &session.SessionType, &session.Title, &session.CurrentStatus, &session.AgentID, &session.AgentVersionID, &session.ProviderConfigID, &session.CreatedAt, &session.UpdatedAt); err != nil {
		return domain.TurnCreated{}, mapErr(err)
	}
	var turn domain.Turn
	if err := tx.QueryRow(ctx, `
		INSERT INTO turns(workspace_id, session_id, status)
		VALUES($1::uuid, $2::uuid, $3)
		RETURNING id::text, workspace_id::text, session_id::text, interaction_id::text, COALESCE(user_message_id::text, ''), assistant_message_id::text, status, created_at, updated_at
	`, workspaceID, sessionID, domain.TurnStatusCreated).Scan(&turn.ID, &turn.WorkspaceID, &turn.SessionID, &turn.InteractionID, &turn.UserMessageID, &nullableStringValueScanner{dest: &turn.AssistantMessageID}, &turn.Status, &turn.CreatedAt, &turn.UpdatedAt); err != nil {
		return domain.TurnCreated{}, err
	}
	var message domain.Message
	if err := tx.QueryRow(ctx, `
		INSERT INTO messages(workspace_id, session_id, turn_id, role, content, status)
		VALUES($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
		RETURNING id::text, workspace_id::text, session_id::text, turn_id::text, agent_id::text, role, content, status, created_at
	`, workspaceID, sessionID, turn.ID, domain.MessageRoleUser, content, domain.MessageStatusDone).Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt); err != nil {
		return domain.TurnCreated{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE turns SET user_message_id=$2::uuid, updated_at=now() WHERE id=$1::uuid`, turn.ID, message.ID); err != nil {
		return domain.TurnCreated{}, err
	}
	turn.UserMessageID = message.ID
	if _, err := tx.Exec(ctx, `UPDATE sessions SET current_turn_id=$2::uuid, last_activity_at=now(), updated_at=now() WHERE id=$1::uuid`, sessionID, turn.ID); err != nil {
		return domain.TurnCreated{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.TurnCreated{}, err
	}
	return domain.TurnCreated{Turn: turn, UserMessage: message}, nil
}

func (r *Repository) GetTurn(ctx context.Context, workspaceID string, turnID string) (domain.Turn, error) {
	var turn domain.Turn
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, session_id::text, interaction_id::text, COALESCE(user_message_id::text, ''), assistant_message_id::text, status, created_at, updated_at
		FROM turns WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, turnID).Scan(&turn.ID, &turn.WorkspaceID, &turn.SessionID, &turn.InteractionID, &turn.UserMessageID, &nullableStringValueScanner{dest: &turn.AssistantMessageID}, &turn.Status, &turn.CreatedAt, &turn.UpdatedAt)
	if err != nil {
		return domain.Turn{}, mapErr(err)
	}
	return turn, nil
}

func (r *Repository) GetMessage(ctx context.Context, workspaceID string, messageID string) (domain.Message, error) {
	var message domain.Message
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, session_id::text, COALESCE(turn_id::text, ''), agent_id::text, role, content, status, created_at
		FROM messages WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, messageID).Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt)
	if err != nil {
		return domain.Message{}, mapErr(err)
	}
	return message, nil
}

func (r *Repository) CreateAssistantMessage(ctx context.Context, workspaceID string, sessionID string, turnID string, agentID string) (domain.Message, error) {
	var message domain.Message
	err := r.pool.QueryRow(ctx, `
		INSERT INTO messages(workspace_id, session_id, turn_id, agent_id, role, content, status)
		VALUES($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, '', $6)
		RETURNING id::text, workspace_id::text, session_id::text, turn_id::text, agent_id::text, role, content, status, created_at
	`, workspaceID, sessionID, turnID, agentID, domain.MessageRoleAssistant, domain.MessageStatusPending).Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt)
	if err != nil {
		return domain.Message{}, err
	}
	return message, nil
}

func (r *Repository) SetTurnAssistantMessage(ctx context.Context, workspaceID string, turnID string, messageID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE turns SET assistant_message_id=$3::uuid, updated_at=now() WHERE workspace_id=$1::uuid AND id=$2::uuid`, workspaceID, turnID, messageID)
	return err
}

func (r *Repository) AppendAssistantContent(ctx context.Context, workspaceID string, messageID string, delta string, status string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE messages SET content = content || $3, status=$4, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, messageID, delta, status)
	return err
}

func (r *Repository) UpdateTurnStatus(ctx context.Context, workspaceID string, turnID string, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE turns SET status=$3, updated_at=now() WHERE workspace_id=$1::uuid AND id=$2::uuid`, workspaceID, turnID, status)
	return err
}

func (r *Repository) ListMessages(ctx context.Context, workspaceID string, sessionID string) ([]domain.Message, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, session_id::text, COALESCE(turn_id::text, ''), agent_id::text, role, content, status, created_at
		FROM messages WHERE workspace_id=$1::uuid AND session_id=$2::uuid
		ORDER BY created_at ASC
	`, workspaceID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := make([]domain.Message, 0)
	for rows.Next() {
		var message domain.Message
		if err := rows.Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func (r *Repository) ListRecentMessages(ctx context.Context, workspaceID string, sessionID string, limit int) ([]domain.Message, error) {
	if limit <= 0 {
		limit = 12
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, session_id::text, COALESCE(turn_id::text, ''), agent_id::text, role, content, status, created_at
		FROM (
			SELECT id, workspace_id, session_id, turn_id, agent_id, role, content, status, created_at
			FROM messages
			WHERE workspace_id=$1::uuid AND session_id=$2::uuid AND role IN ($3, $4) AND trim(content) <> ''
			ORDER BY created_at DESC
			LIMIT $5
		) recent
		ORDER BY created_at ASC
	`, workspaceID, sessionID, domain.MessageRoleUser, domain.MessageRoleAssistant, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := make([]domain.Message, 0)
	for rows.Next() {
		var message domain.Message
		if err := rows.Scan(&message.ID, &message.WorkspaceID, &message.SessionID, &message.TurnID, &nullableStringScanner{dest: &message.AgentID}, &message.Role, &message.Content, &message.Status, &message.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func compactPreview(value string, limit int) string {
	preview := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	if limit <= 0 || len(preview) <= limit {
		return preview
	}
	return preview[:limit] + "..."
}

func (r *Repository) NextSSESequence(ctx context.Context, turnID string) (int, error) {
	var next int
	if err := r.pool.QueryRow(ctx, `SELECT COALESCE(MAX(sequence), 0) + 1 FROM sse_events WHERE turn_id=$1::uuid`, turnID).Scan(&next); err != nil {
		return 0, err
	}
	return next, nil
}

func (r *Repository) InsertSSEEvent(ctx context.Context, workspaceID string, sessionID string, turnID string, eventID string, sequence int, eventType string, payload []byte) (domain.SSEEvent, error) {
	if !json.Valid(payload) {
		return domain.SSEEvent{}, errors.New("invalid sse payload json")
	}
	var event domain.SSEEvent
	err := r.pool.QueryRow(ctx, `
		INSERT INTO sse_events(workspace_id, session_id, turn_id, event_id, sequence, event_type, payload)
		VALUES($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb)
		RETURNING id::text, event_id, sequence, event_type, payload::text, created_at
	`, workspaceID, sessionID, turnID, eventID, sequence, eventType, string(payload)).Scan(&event.ID, &event.EventID, &event.Sequence, &event.EventType, &jsonBytesScanner{dest: &event.Payload}, &event.CreatedAt)
	if err != nil {
		return domain.SSEEvent{}, err
	}
	return event, nil
}

func (r *Repository) ListSSEEventsAfter(ctx context.Context, turnID string, afterSequence int) ([]domain.SSEEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, event_id, sequence, event_type, payload::text, created_at
		FROM sse_events WHERE turn_id=$1::uuid AND sequence > $2
		ORDER BY sequence ASC
	`, turnID, afterSequence)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]domain.SSEEvent, 0)
	for rows.Next() {
		var event domain.SSEEvent
		if err := rows.Scan(&event.ID, &event.EventID, &event.Sequence, &event.EventType, &jsonBytesScanner{dest: &event.Payload}, &event.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func scanAgent(rows pgx.Rows) (domain.Agent, error) {
	var agent domain.Agent
	err := rows.Scan(&agent.ID, &nullableStringScanner{dest: &agent.WorkspaceID}, &agent.DisplayName, &agent.Slug, &agent.AvatarEmoji, &agent.RoleSummary, &agent.Status, &agent.IsPublicTemplate, &agent.CurrentVersionID, &agent.CreatedAt, &agent.UpdatedAt)
	return agent, err
}

func mapErr(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}

func displayName(email string) string {
	local := strings.Split(email, "@")[0]
	if local == "" {
		return email
	}
	return local
}

func workspaceName(email string) string {
	local := displayName(email)
	return fmt.Sprintf("%s 的桑拿房", local)
}

type nullableStringScanner struct {
	dest **string
}

func (s *nullableStringScanner) Scan(src any) error {
	if src == nil {
		*s.dest = nil
		return nil
	}
	var v string
	switch value := src.(type) {
	case string:
		v = value
	case []byte:
		v = string(value)
	default:
		v = fmt.Sprint(value)
	}
	*s.dest = &v
	return nil
}

type nullableStringValueScanner struct {
	dest **string
}

func (s *nullableStringValueScanner) Scan(src any) error {
	return (&nullableStringScanner{dest: s.dest}).Scan(src)
}

type nullableTimeScanner struct {
	dest **time.Time
}

func (s *nullableTimeScanner) Scan(src any) error {
	if src == nil {
		*s.dest = nil
		return nil
	}
	switch value := src.(type) {
	case time.Time:
		v := value
		*s.dest = &v
		return nil
	default:
		return fmt.Errorf("unsupported nullable time scan type %T", src)
	}
}

type jsonBytesScanner struct {
	dest any
}

func (s *jsonBytesScanner) Scan(src any) error {
	var data []byte
	switch value := src.(type) {
	case string:
		data = []byte(value)
	case []byte:
		data = append([]byte(nil), value...)
	case nil:
		data = nil
	default:
		return fmt.Errorf("unsupported json scan type %T", src)
	}
	switch dest := s.dest.(type) {
	case *[]byte:
		*dest = data
	case *json.RawMessage:
		*dest = json.RawMessage(data)
	default:
		return fmt.Errorf("unsupported json destination type %T", s.dest)
	}
	return nil
}

func (r *Repository) ListWorkspaceAgents(ctx context.Context, workspaceID string) ([]domain.Agent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, display_name, slug, avatar_emoji, role_summary, status, is_public_template, current_version_id::text, created_at, updated_at
		FROM agents
		WHERE workspace_id=$1::uuid AND is_public_template=false AND deleted_at IS NULL
		ORDER BY updated_at DESC, created_at DESC
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := make([]domain.Agent, 0)
	for rows.Next() {
		agent, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, rows.Err()
}

func (r *Repository) CreateDistillationJob(ctx context.Context, input service.CreateDistillationJobInput) (domain.DistillationJob, error) {
	sourceURLs, _ := json.Marshal(input.SourceURLs)
	uploadedIDs, _ := json.Marshal(input.UploadedSourceIDs)
	var job domain.DistillationJob
	err := r.pool.QueryRow(ctx, `
		INSERT INTO distillation_jobs(workspace_id, target_name, target_type, input_brief, source_urls, uploaded_source_ids, provider_config_id, status, progress_message)
		VALUES($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::uuid, 'queued', '已创建蒸馏任务，等待 nuwa-skill agent 处理。')
		RETURNING id::text, workspace_id::text, target_name, target_type, input_brief, source_urls, uploaded_source_ids, provider_config_id::text, status, progress_message, result_agent_id::text, result_skill_markdown, error_message, created_at, updated_at, completed_at
	`, input.WorkspaceID, input.TargetName, input.TargetType, input.InputBrief, sourceURLs, uploadedIDs, input.ProviderConfigID).Scan(scanDistillationJob(&job)...)
	if err != nil {
		return domain.DistillationJob{}, mapErr(err)
	}
	return job, nil
}

func (r *Repository) ListDistillationJobs(ctx context.Context, workspaceID string) ([]domain.DistillationJob, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, workspace_id::text, target_name, target_type, input_brief, source_urls, uploaded_source_ids, provider_config_id::text, status, progress_message, result_agent_id::text, result_skill_markdown, error_message, created_at, updated_at, completed_at
		FROM distillation_jobs
		WHERE workspace_id=$1::uuid
		ORDER BY created_at DESC
		LIMIT 50
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	jobs := make([]domain.DistillationJob, 0)
	for rows.Next() {
		var job domain.DistillationJob
		if err := rows.Scan(scanDistillationJob(&job)...); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (r *Repository) GetDistillationJob(ctx context.Context, workspaceID string, jobID string) (domain.DistillationJob, error) {
	var job domain.DistillationJob
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, target_name, target_type, input_brief, source_urls, uploaded_source_ids, provider_config_id::text, status, progress_message, result_agent_id::text, result_skill_markdown, error_message, created_at, updated_at, completed_at
		FROM distillation_jobs
		WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, jobID).Scan(scanDistillationJob(&job)...)
	if err != nil {
		return domain.DistillationJob{}, mapErr(err)
	}
	return job, nil
}

func (r *Repository) UpdateDistillationJobStatus(ctx context.Context, workspaceID string, jobID string, status string, progressMessage string, errorMessage string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE distillation_jobs
		SET status=$3, progress_message=$4, error_message=$5, updated_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, jobID, status, progressMessage, errorMessage)
	return err
}

func (r *Repository) CompleteDistillationJob(ctx context.Context, workspaceID string, jobID string, input service.CompleteDistillationJobInput) (domain.DistillationJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.DistillationJob{}, err
	}
	defer tx.Rollback(ctx)

	slug := input.Slug
	if strings.TrimSpace(slug) == "" {
		slug = strings.ToLower(strings.ReplaceAll(input.TargetName, " ", "-"))
	}
	var agentID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO agents(workspace_id, display_name, slug, avatar_emoji, role_summary, status, is_public_template)
		VALUES($1::uuid, $2, $3, $4, $5, 'idle', false)
		ON CONFLICT (workspace_id, slug) WHERE NOT is_public_template AND deleted_at IS NULL DO UPDATE SET
		  display_name=EXCLUDED.display_name,
		  avatar_emoji=EXCLUDED.avatar_emoji,
		  role_summary=EXCLUDED.role_summary,
		  updated_at=now()
		RETURNING id::text
	`, workspaceID, input.TargetName, slug, input.AvatarEmoji, input.RoleSummary).Scan(&agentID); err != nil {
		return domain.DistillationJob{}, err
	}

	var nextVersion int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(max(version_no), 0) + 1 FROM agent_versions WHERE agent_id=$1::uuid`, agentID).Scan(&nextVersion); err != nil {
		return domain.DistillationJob{}, err
	}
	var versionID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO agent_versions(agent_id, version_no, system_prompt, skill_markdown, honesty_boundaries, status, published_at, skill_source, skill_repo_url, skill_commit_sha, skill_metadata, quality_report)
		VALUES($1::uuid, $2, $3, $4, '由 nuwa-skill 蒸馏生成，非本人观点。', 'published', now(), $5, $6, $7, $8::jsonb, $9::jsonb)
		RETURNING id::text
	`, agentID, nextVersion, input.SystemPrompt, input.SkillMarkdown, input.SkillSource, input.SkillRepoURL, input.SkillCommitSHA, input.SkillMetadata, input.QualityReport).Scan(&versionID); err != nil {
		return domain.DistillationJob{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE agents SET current_version_id=$2::uuid, updated_at=now() WHERE id=$1::uuid`, agentID, versionID); err != nil {
		return domain.DistillationJob{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE distillation_jobs
		SET status='completed', progress_message='蒸馏完成，已生成可对话的 Agent Skill。', result_agent_id=$3::uuid, result_skill_markdown=$4, error_message='', updated_at=now(), completed_at=now()
		WHERE workspace_id=$1::uuid AND id=$2::uuid
	`, workspaceID, jobID, agentID, input.SkillMarkdown); err != nil {
		return domain.DistillationJob{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.DistillationJob{}, err
	}
	return r.GetDistillationJob(ctx, workspaceID, jobID)
}

func scanDistillationJob(job *domain.DistillationJob) []any {
	return []any{
		&job.ID,
		&job.WorkspaceID,
		&job.TargetName,
		&job.TargetType,
		&job.InputBrief,
		&jsonStringSliceScanner{dest: &job.SourceURLs},
		&jsonStringSliceScanner{dest: &job.UploadedSourceIDs},
		&nullableStringScanner{dest: &job.ProviderConfigID},
		&job.Status,
		&job.ProgressMessage,
		&nullableStringScanner{dest: &job.ResultAgentID},
		&job.ResultSkillMarkdown,
		&job.ErrorMessage,
		&job.CreatedAt,
		&job.UpdatedAt,
		&nullableTimeScanner{dest: &job.CompletedAt},
	}
}

type jsonStringSliceScanner struct {
	dest *[]string
}

func (s *jsonStringSliceScanner) Scan(value any) error {
	if s.dest == nil {
		return nil
	}
	if value == nil {
		*s.dest = []string{}
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("unsupported json string slice type %T", value)
	}
	if len(data) == 0 {
		*s.dest = []string{}
		return nil
	}
	return json.Unmarshal(data, s.dest)
}
