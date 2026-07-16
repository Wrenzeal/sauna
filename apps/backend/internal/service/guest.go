package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"sauna/backend/internal/domain"
	"sauna/backend/internal/llm"
)

type GuestPlatformConfig struct {
	BaseURL string
	APIKey  string
	Model   string
	TTL     time.Duration
	Limit   int
}

type GuestQuota interface {
	AllowGuestTurn(ctx context.Context, identity string, limit int) (remaining int, err error)
}

type GuestRepository interface {
	GetPublicAgentWithCurrentVersion(ctx context.Context, agentID string) (domain.AgentWithVersion, error)
	StartGuestConsultation(ctx context.Context, deviceHash, agentID, title, content string, expiresAt time.Time) (domain.GuestTurnCreated, error)
	CreateGuestTurn(ctx context.Context, deviceHash, sessionID, content string) (domain.GuestTurnCreated, error)
	GetGuestSession(ctx context.Context, deviceHash, sessionID string) (domain.GuestSession, error)
	GetGuestTurn(ctx context.Context, deviceHash, sessionID, turnID string) (domain.Turn, error)
	GetGuestMessage(ctx context.Context, deviceHash, messageID string) (domain.Message, error)
	CreateGuestAssistantMessage(ctx context.Context, deviceHash, sessionID, turnID, agentID string) (domain.Message, error)
	SetGuestTurnAssistantMessage(ctx context.Context, deviceHash, turnID, messageID string) error
	AppendGuestAssistantContent(ctx context.Context, deviceHash, messageID, delta, status string) error
	MarkGuestAssistantFailed(ctx context.Context, deviceHash, messageID, errorMessage string) error
	UpdateGuestTurnStatus(ctx context.Context, deviceHash, turnID, status string) error
	ListGuestMessages(ctx context.Context, deviceHash, sessionID string) ([]domain.Message, error)
	ListRecentGuestMessages(ctx context.Context, deviceHash, sessionID string, limit int) ([]domain.Message, error)
	NextGuestSSESequence(ctx context.Context, turnID string) (int, error)
	InsertGuestSSEEvent(ctx context.Context, deviceHash, sessionID, turnID, eventID string, sequence int, eventType string, payload []byte) (domain.SSEEvent, error)
	ListGuestSSEEventsAfter(ctx context.Context, deviceHash, turnID string, afterSequence int) ([]domain.SSEEvent, error)
	DeleteExpiredGuestSessions(ctx context.Context) error
}

type GuestService struct {
	repo   GuestRepository
	quota  GuestQuota
	llm    llm.Client
	config GuestPlatformConfig
}

func NewGuestService(repo GuestRepository, quota GuestQuota, client llm.Client, config GuestPlatformConfig) *GuestService {
	if config.TTL <= 0 {
		config.TTL = 24 * time.Hour
	}
	if config.Limit <= 0 {
		config.Limit = 3
	}
	return &GuestService{repo: repo, quota: quota, llm: client, config: config}
}

func (s *GuestService) Available() bool {
	return strings.TrimSpace(s.config.BaseURL) != "" && strings.TrimSpace(s.config.APIKey) != "" && strings.TrimSpace(s.config.Model) != ""
}

func (s *GuestService) Start(ctx context.Context, deviceHash, quotaIdentity, agentID, content string) (domain.GuestTurnCreated, error) {
	content = strings.TrimSpace(content)
	agentID = strings.TrimSpace(agentID)
	if !s.Available() {
		return domain.GuestTurnCreated{}, domain.ErrGuestProviderUnavailable
	}
	if content == "" || agentID == "" || len([]rune(content)) > 1200 {
		return domain.GuestTurnCreated{}, domain.ErrInvalidInput
	}
	remaining, err := s.quota.AllowGuestTurn(ctx, quotaIdentity, s.config.Limit)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	if remaining < 0 {
		return domain.GuestTurnCreated{}, domain.ErrRateLimited
	}
	agent, err := s.repo.GetPublicAgentWithCurrentVersion(ctx, agentID)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	runes := []rune(content)
	if len(runes) > 24 {
		runes = runes[:24]
	}
	title := agent.Agent.DisplayName + ": " + string(runes)
	result, err := s.repo.StartGuestConsultation(ctx, deviceHash, agentID, title, content, time.Now().UTC().Add(s.config.TTL))
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	result.Remaining = remaining
	return result, nil
}
func (s *GuestService) CreateTurn(ctx context.Context, deviceHash, quotaIdentity, sessionID, content string) (domain.GuestTurnCreated, error) {
	content = strings.TrimSpace(content)
	if !s.Available() {
		return domain.GuestTurnCreated{}, domain.ErrGuestProviderUnavailable
	}
	if content == "" || len([]rune(content)) > 1200 {
		return domain.GuestTurnCreated{}, domain.ErrInvalidInput
	}
	remaining, err := s.quota.AllowGuestTurn(ctx, quotaIdentity, s.config.Limit)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	if remaining < 0 {
		return domain.GuestTurnCreated{}, domain.ErrRateLimited
	}
	result, err := s.repo.CreateGuestTurn(ctx, deviceHash, sessionID, content)
	if err != nil {
		return domain.GuestTurnCreated{}, err
	}
	result.Remaining = remaining
	return result, nil
}
func (s *GuestService) Messages(ctx context.Context, deviceHash, sessionID string) ([]domain.Message, error) {
	return s.repo.ListGuestMessages(ctx, deviceHash, sessionID)
}
func (s *GuestService) Replay(ctx context.Context, deviceHash, turnID string, after int) ([]domain.SSEEvent, error) {
	return s.repo.ListGuestSSEEventsAfter(ctx, deviceHash, turnID, after)
}
func (s *GuestService) Cleanup(ctx context.Context) error {
	return s.repo.DeleteExpiredGuestSessions(ctx)
}

func (s *GuestService) StreamTurn(ctx context.Context, deviceHash, sessionID, turnID, lastEventID string, emit func(StreamFrame) error) error {
	turn, err := s.repo.GetGuestTurn(ctx, deviceHash, sessionID, turnID)
	if err != nil {
		return err
	}
	afterSequence := 0
	if parts := strings.Split(lastEventID, ":"); len(parts) > 0 {
		if parsed, parseErr := strconv.Atoi(parts[len(parts)-1]); parseErr == nil {
			afterSequence = parsed
		}
	}
	replayed, err := s.repo.ListGuestSSEEventsAfter(ctx, deviceHash, turnID, afterSequence)
	if err != nil {
		return err
	}
	for _, event := range replayed {
		if err := emit(StreamFrame{Event: event, Data: event.Payload}); err != nil {
			return err
		}
	}
	if turn.AssistantMessageID != nil || turn.Status == domain.TurnStatusCompleted || turn.Status == domain.TurnStatusFailed {
		return nil
	}
	session, err := s.repo.GetGuestSession(ctx, deviceHash, sessionID)
	if err != nil {
		return err
	}
	agent, err := s.repo.GetPublicAgentWithCurrentVersion(ctx, session.AgentID)
	if err != nil {
		return err
	}
	userMessage, err := s.repo.GetGuestMessage(ctx, deviceHash, turn.UserMessageID)
	if err != nil {
		return err
	}
	assistant, err := s.repo.CreateGuestAssistantMessage(ctx, deviceHash, session.ID, turn.ID, session.AgentID)
	if err != nil {
		return err
	}
	if err = s.repo.SetGuestTurnAssistantMessage(ctx, deviceHash, turn.ID, assistant.ID); err != nil {
		return err
	}
	if err = s.repo.UpdateGuestTurnStatus(ctx, deviceHash, turn.ID, domain.TurnStatusStreaming); err != nil {
		return err
	}
	sequence, err := s.repo.NextGuestSSESequence(ctx, turn.ID)
	if err != nil {
		return err
	}
	emitPersisted := func(eventType string, payload domain.SSEPayload) error {
		eventID := fmt.Sprintf("guest:%s:%d", turn.ID, sequence)
		payload.EventID = eventID
		payload.Sequence = sequence
		payload.TurnID = turn.ID
		payload.SessionID = turn.SessionID
		payload.MessageID = assistant.ID
		payload.Timestamp = time.Now().UTC()
		payload.InteractionID = turn.InteractionID
		payload.AgentID = session.AgentID
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		event, err := s.repo.InsertGuestSSEEvent(ctx, deviceHash, turn.SessionID, turn.ID, eventID, sequence, eventType, data)
		if err != nil {
			return err
		}
		sequence++
		return emit(StreamFrame{Event: event, Data: data})
	}
	if err = emitPersisted(domain.SSEEventAssistantMessageCreated, domain.SSEPayload{}); err != nil {
		return err
	}
	history, err := s.repo.ListRecentGuestMessages(ctx, deviceHash, session.ID, focusContextMessageLimit)
	if err != nil {
		return err
	}
	messages := buildChatMessages(agent, history, userMessage)
	usage, runErr := s.llm.StreamChat(ctx, llm.ChatRequest{BaseURL: s.config.BaseURL, APIKey: s.config.APIKey, Model: s.config.Model, Messages: messages}, func(delta string) error {
		if err := s.repo.AppendGuestAssistantContent(ctx, deviceHash, assistant.ID, delta, domain.MessageStatusPartial); err != nil {
			return err
		}
		return emitPersisted(domain.SSEEventAssistantDelta, domain.SSEPayload{Delta: delta})
	})
	if runErr != nil {
		_ = s.repo.UpdateGuestTurnStatus(ctx, deviceHash, turn.ID, domain.TurnStatusFailed)
		_ = s.repo.MarkGuestAssistantFailed(ctx, deviceHash, assistant.ID, runErr.Error())
		return emitPersisted(domain.SSEEventTurnFailed, domain.SSEPayload{Error: runErr.Error()})
	}
	if err = s.repo.AppendGuestAssistantContent(ctx, deviceHash, assistant.ID, "", domain.MessageStatusDone); err != nil {
		return err
	}
	if err = s.repo.UpdateGuestTurnStatus(ctx, deviceHash, turn.ID, domain.TurnStatusCompleted); err != nil {
		return err
	}
	return emitPersisted(domain.SSEEventTurnCompleted, domain.SSEPayload{Usage: &domain.TokenUsage{PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens}})
}
