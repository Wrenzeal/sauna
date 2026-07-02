package service

import (
	"context"
	"time"

	"sauna/backend/internal/domain"
)

type AuthRepository interface {
	UpsertUserWorkspace(ctx context.Context, email string) (domain.AuthIdentity, error)
	CreateAuthSession(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) error
	GetIdentityByTokenHash(ctx context.Context, tokenHash string) (domain.AuthIdentity, error)
	RevokeAuthSession(ctx context.Context, tokenHash string) error
}

type ProviderRepository interface {
	CreateProviderConfig(ctx context.Context, input CreateProviderInput) (domain.ProviderConfig, error)
	ListProviderConfigs(ctx context.Context, workspaceID string) ([]domain.ProviderConfig, error)
	UpdateProviderConfig(ctx context.Context, input UpdateProviderInput) (domain.ProviderConfig, error)
	DeleteProviderConfig(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error)
	GetProviderSecret(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderSecret, error)
	GetDefaultProviderSecret(ctx context.Context, workspaceID string) (domain.ProviderSecret, error)
	SetDefaultProviderConfig(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error)
	MarkProviderTested(ctx context.Context, workspaceID string, providerConfigID string, status string) error
}

type AgentRepository interface {
	ListPublicAgents(ctx context.Context) ([]domain.Agent, error)
	ListWorkspaceAgents(ctx context.Context, workspaceID string) ([]domain.Agent, error)
	GetAgentWithCurrentVersion(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error)
	ClonePublicAgent(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error)
}

type DistillationRepository interface {
	CreateDistillationJob(ctx context.Context, input CreateDistillationJobInput) (domain.DistillationJob, error)
	ListDistillationJobs(ctx context.Context, workspaceID string) ([]domain.DistillationJob, error)
	GetDistillationJob(ctx context.Context, workspaceID string, jobID string) (domain.DistillationJob, error)
	UpdateDistillationJobStatus(ctx context.Context, workspaceID string, jobID string, status string, progressMessage string, errorMessage string) error
	CompleteDistillationJob(ctx context.Context, workspaceID string, jobID string, input CompleteDistillationJobInput) (domain.DistillationJob, error)
}

type FocusRoomRepository interface {
	GetAgentWithCurrentVersion(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error)
	GetDefaultProviderSecret(ctx context.Context, workspaceID string) (domain.ProviderSecret, error)
	GetProviderSecret(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderSecret, error)
	CreateFocusSession(ctx context.Context, workspaceID string, agentID string, providerConfigID string, title string) (domain.Session, error)
	StartConsultation(ctx context.Context, workspaceID string, agentID string, providerConfigID string, title string, content string) (domain.ConsultationStarted, error)
	ListFocusSessions(ctx context.Context, workspaceID string) ([]domain.FocusSessionSummary, error)
	GetSession(ctx context.Context, workspaceID string, sessionID string) (domain.Session, error)
	RenameSession(ctx context.Context, workspaceID string, sessionID string, title string) (domain.Session, error)
	DeleteSession(ctx context.Context, workspaceID string, sessionID string) error
	CreateTurn(ctx context.Context, workspaceID string, sessionID string, content string) (domain.TurnCreated, error)
	GetTurn(ctx context.Context, workspaceID string, turnID string) (domain.Turn, error)
	GetMessage(ctx context.Context, workspaceID string, messageID string) (domain.Message, error)
	CreateAssistantMessage(ctx context.Context, workspaceID string, sessionID string, turnID string, agentID string) (domain.Message, error)
	SetTurnAssistantMessage(ctx context.Context, workspaceID string, turnID string, messageID string) error
	AppendAssistantContent(ctx context.Context, workspaceID string, messageID string, delta string, status string) error
	UpdateTurnStatus(ctx context.Context, workspaceID string, turnID string, status string) error
	ListMessages(ctx context.Context, workspaceID string, sessionID string) ([]domain.Message, error)
	ListRecentMessages(ctx context.Context, workspaceID string, sessionID string, limit int) ([]domain.Message, error)
	NextSSESequence(ctx context.Context, turnID string) (int, error)
	InsertSSEEvent(ctx context.Context, workspaceID string, sessionID string, turnID string, eventID string, sequence int, eventType string, payload []byte) (domain.SSEEvent, error)
	ListSSEEventsAfter(ctx context.Context, turnID string, afterSequence int) ([]domain.SSEEvent, error)
}
