package domain

import (
	"encoding/json"
	"errors"
	"time"
)

const (
	SessionTypeFocus = "focus_room"

	TurnStatusCreated   = "created"
	TurnStatusStreaming = "streaming"
	TurnStatusCompleted = "completed"
	TurnStatusFailed    = "failed"

	MessageRoleUser      = "user"
	MessageRoleAssistant = "assistant"
	MessageStatusPending = "pending"
	MessageStatusPartial = "partial"
	MessageStatusDone    = "complete"
	MessageStatusFailed  = "failed"

	SSEEventTurnCreated             = "turn.created"
	SSEEventAssistantMessageCreated = "assistant.message.created"
	SSEEventAssistantDelta          = "assistant.delta"
	SSEEventTurnCompleted           = "turn.completed"
	SSEEventTurnFailed              = "turn.failed"
	SSEEventStreamReplay            = "stream.replay"
)

var (
	ErrNotFound                = errors.New("not_found")
	ErrUnauthorized            = errors.New("unauthorized")
	ErrProviderConfigRequired  = errors.New("provider_config_required")
	ErrForbidden               = errors.New("forbidden")
	ErrRateLimited             = errors.New("rate_limited")
	ErrInvalidInput            = errors.New("invalid_input")
	ErrProviderInUse           = errors.New("provider_config_in_use")
	ErrJobNotReady             = errors.New("distillation_job_not_ready")
	ErrEmailDelivery           = errors.New("email_delivery_failed")
	ErrInvalidVerificationCode = errors.New("invalid_verification_code")
	ErrVerificationCooldown    = errors.New("verification_code_cooldown")
	ErrTurnNotRetryable        = errors.New("turn_not_retryable")
)

type VerificationCooldownError struct {
	RetryAfter time.Duration
}

func (e *VerificationCooldownError) Error() string {
	return ErrVerificationCooldown.Error()
}

func (e *VerificationCooldownError) Unwrap() error {
	return ErrVerificationCooldown
}

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type Workspace struct {
	ID          string    `json:"id"`
	OwnerUserID string    `json:"owner_user_id"`
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"created_at"`
}

type AuthIdentity struct {
	User      User      `json:"user"`
	Workspace Workspace `json:"workspace"`
}

type ProviderConfig struct {
	ID             string     `json:"id"`
	WorkspaceID    string     `json:"workspace_id"`
	ProviderName   string     `json:"provider_name"`
	BaseURL        string     `json:"base_url"`
	ChatModel      string     `json:"chat_model"`
	EmbeddingModel string     `json:"embedding_model"`
	MaskedAPIKey   string     `json:"masked_api_key"`
	IsDefault      bool       `json:"is_default"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	LastTestedAt   *time.Time `json:"last_tested_at,omitempty"`
}

type ProviderSecret struct {
	ProviderConfig
	APIKeyCiphertext string `json:"-"`
	APIKey           string `json:"-"`
}

type Agent struct {
	ID               string    `json:"id"`
	WorkspaceID      *string   `json:"workspace_id,omitempty"`
	DisplayName      string    `json:"display_name"`
	Slug             string    `json:"slug"`
	AvatarEmoji      string    `json:"avatar_emoji"`
	RoleSummary      string    `json:"role_summary"`
	Status           string    `json:"status"`
	IsPublicTemplate bool      `json:"is_public_template"`
	CurrentVersionID string    `json:"current_version_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AgentVersion struct {
	ID                 string          `json:"id"`
	AgentID            string          `json:"agent_id"`
	VersionNo          int             `json:"version_no"`
	SystemPrompt       string          `json:"system_prompt"`
	SkillMarkdown      string          `json:"skill_markdown"`
	ExpressionDNA      string          `json:"expression_dna"`
	MentalModels       string          `json:"mental_models"`
	DecisionHeuristics string          `json:"decision_heuristics"`
	AntiPatterns       string          `json:"anti_patterns"`
	HonestyBoundaries  string          `json:"honesty_boundaries"`
	Status             string          `json:"status"`
	PublishedAt        *time.Time      `json:"published_at,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	SkillSource        string          `json:"skill_source"`
	SkillRepoURL       string          `json:"skill_repo_url"`
	SkillCommitSHA     string          `json:"skill_commit_sha"`
	SkillMetadata      json.RawMessage `json:"skill_metadata"`
	QualityReport      json.RawMessage `json:"quality_report"`
}

type AgentWithVersion struct {
	Agent   Agent        `json:"agent"`
	Version AgentVersion `json:"version"`
}

const (
	DistillationStatusQueued      = "queued"
	DistillationStatusResearching = "researching"
	DistillationStatusExtracting  = "extracting"
	DistillationStatusValidating  = "validating"
	DistillationStatusCompleted   = "completed"
	DistillationStatusFailed      = "failed"
)

type DistillationJob struct {
	ID                  string     `json:"id"`
	WorkspaceID         string     `json:"workspace_id"`
	TargetName          string     `json:"target_name"`
	TargetType          string     `json:"target_type"`
	InputBrief          string     `json:"input_brief"`
	SourceURLs          []string   `json:"source_urls"`
	UploadedSourceIDs   []string   `json:"uploaded_source_ids"`
	ProviderConfigID    *string    `json:"provider_config_id,omitempty"`
	Status              string     `json:"status"`
	ProgressMessage     string     `json:"progress_message"`
	ResultAgentID       *string    `json:"result_agent_id,omitempty"`
	ResultSkillMarkdown string     `json:"result_skill_markdown,omitempty"`
	ErrorMessage        string     `json:"error_message"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
}

type Session struct {
	ID               string    `json:"id"`
	WorkspaceID      string    `json:"workspace_id"`
	SessionType      string    `json:"session_type"`
	Title            string    `json:"title"`
	CurrentStatus    string    `json:"current_status"`
	AgentID          string    `json:"agent_id"`
	AgentVersionID   string    `json:"agent_version_id"`
	ProviderConfigID string    `json:"provider_config_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type FocusSessionSummary struct {
	ID                 string    `json:"id"`
	WorkspaceID        string    `json:"workspace_id"`
	SessionType        string    `json:"session_type"`
	Title              string    `json:"title"`
	CurrentStatus      string    `json:"current_status"`
	AgentID            string    `json:"agent_id"`
	ProviderConfigID   string    `json:"provider_config_id"`
	AgentDisplayName   string    `json:"agent_display_name"`
	AgentAvatarEmoji   string    `json:"agent_avatar_emoji"`
	LastMessagePreview string    `json:"last_message_preview"`
	LastActivityAt     time.Time `json:"last_activity_at"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Message struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	SessionID   string    `json:"session_id"`
	TurnID      string    `json:"turn_id"`
	AgentID     *string   `json:"agent_id,omitempty"`
	Role        string    `json:"role"`
	Content     string    `json:"content"`
	Status      string    `json:"status"`
	Error       string    `json:"error,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Turn struct {
	ID                 string    `json:"id"`
	WorkspaceID        string    `json:"workspace_id"`
	SessionID          string    `json:"session_id"`
	InteractionID      string    `json:"interaction_id"`
	UserMessageID      string    `json:"user_message_id"`
	AssistantMessageID *string   `json:"assistant_message_id,omitempty"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type TurnCreated struct {
	Turn        Turn    `json:"turn"`
	UserMessage Message `json:"user_message"`
}

type ConsultationStarted struct {
	Session     Session `json:"session"`
	Turn        Turn    `json:"turn"`
	UserMessage Message `json:"user_message"`
}

type SSEEvent struct {
	ID        string    `json:"id"`
	EventID   string    `json:"event_id"`
	Sequence  int       `json:"sequence"`
	EventType string    `json:"event_type"`
	Payload   []byte    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type SSEPayload struct {
	EventID       string      `json:"event_id"`
	Sequence      int         `json:"sequence"`
	TurnID        string      `json:"turn_id"`
	SessionID     string      `json:"session_id"`
	MessageID     string      `json:"message_id"`
	Timestamp     time.Time   `json:"timestamp"`
	InteractionID string      `json:"interaction_id,omitempty"`
	AgentID       string      `json:"agent_id,omitempty"`
	Delta         string      `json:"delta,omitempty"`
	Error         string      `json:"error,omitempty"`
	Usage         *TokenUsage `json:"usage,omitempty"`
}

type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}
