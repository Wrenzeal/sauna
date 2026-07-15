package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	secretcrypto "sauna/backend/internal/crypto"
	"sauna/backend/internal/domain"
	"sauna/backend/internal/llm"
)

type FocusRoomService struct {
	repo FocusRoomRepository
	box  secretcrypto.SecretBox
	llm  llm.Client
}

const (
	focusContextMessageLimit    = 12
	defaultFocusSessionPageSize = 20
	maximumFocusSessionPageSize = 50
)

type CreateSessionRequest struct {
	AgentID          string `json:"agent_id"`
	ProviderConfigID string `json:"provider_config_id"`
	Title            string `json:"title"`
}

type CreateTurnRequest struct {
	Content string `json:"content"`
}

type StartConsultationRequest struct {
	AgentID          string `json:"agent_id"`
	ProviderConfigID string `json:"provider_config_id"`
	Title            string `json:"title"`
	Content          string `json:"content"`
}

type StreamFrame struct {
	Event domain.SSEEvent `json:"event"`
	Data  []byte          `json:"data"`
}

type ListFocusSessionsRequest struct {
	Limit  int
	Cursor string
}

type FocusSessionPage struct {
	Sessions   []domain.FocusSessionSummary `json:"sessions"`
	NextCursor string                       `json:"next_cursor"`
	HasMore    bool                         `json:"has_more"`
}

type focusSessionCursorPayload struct {
	LastActivityAt time.Time `json:"last_activity_at"`
	CreatedAt      time.Time `json:"created_at"`
	ID             string    `json:"id"`
}

func NewFocusRoomService(repo FocusRoomRepository, box secretcrypto.SecretBox, client llm.Client) *FocusRoomService {
	return &FocusRoomService{repo: repo, box: box, llm: client}
}

func (s *FocusRoomService) CreateSession(ctx context.Context, workspaceID string, request CreateSessionRequest) (domain.Session, error) {
	request.AgentID = strings.TrimSpace(request.AgentID)
	if request.AgentID == "" {
		return domain.Session{}, domain.ErrInvalidInput
	}
	agent, err := s.repo.GetAgentWithCurrentVersion(ctx, workspaceID, request.AgentID)
	if err != nil {
		return domain.Session{}, err
	}
	providerID := strings.TrimSpace(request.ProviderConfigID)
	if providerID == "" {
		provider, err := s.repo.GetDefaultProviderSecret(ctx, workspaceID)
		if err != nil {
			if err == domain.ErrNotFound {
				return domain.Session{}, domain.ErrProviderConfigRequired
			}
			return domain.Session{}, err
		}
		providerID = provider.ID
	} else if _, err := s.repo.GetProviderSecret(ctx, workspaceID, providerID); err != nil {
		return domain.Session{}, err
	}
	title := strings.TrimSpace(request.Title)
	if title == "" {
		title = agent.Agent.DisplayName + " 的 VIP 桑拿房"
	}
	return s.repo.CreateFocusSession(ctx, workspaceID, agent.Agent.ID, providerID, title)
}

func (s *FocusRoomService) RetryTurn(ctx context.Context, workspaceID string, sessionID string, turnID string) (domain.Turn, error) {
	sessionID = strings.TrimSpace(sessionID)
	turnID = strings.TrimSpace(turnID)
	if sessionID == "" || turnID == "" {
		return domain.Turn{}, domain.ErrInvalidInput
	}
	return s.repo.RetryTurn(ctx, workspaceID, sessionID, turnID)
}

func (s *FocusRoomService) CreateTurn(ctx context.Context, workspaceID string, sessionID string, request CreateTurnRequest) (domain.TurnCreated, error) {
	content := strings.TrimSpace(request.Content)
	if content == "" {
		return domain.TurnCreated{}, domain.ErrInvalidInput
	}
	return s.repo.CreateTurn(ctx, workspaceID, sessionID, content)
}

func (s *FocusRoomService) StartConsultation(ctx context.Context, workspaceID string, request StartConsultationRequest) (domain.ConsultationStarted, error) {
	agentID := strings.TrimSpace(request.AgentID)
	content := strings.TrimSpace(request.Content)
	if agentID == "" || content == "" {
		return domain.ConsultationStarted{}, domain.ErrInvalidInput
	}
	agent, err := s.repo.GetAgentWithCurrentVersion(ctx, workspaceID, agentID)
	if err != nil {
		return domain.ConsultationStarted{}, err
	}
	providerID := strings.TrimSpace(request.ProviderConfigID)
	if providerID == "" {
		provider, err := s.repo.GetDefaultProviderSecret(ctx, workspaceID)
		if err != nil {
			if err == domain.ErrNotFound {
				return domain.ConsultationStarted{}, domain.ErrProviderConfigRequired
			}
			return domain.ConsultationStarted{}, err
		}
		providerID = provider.ID
	} else if _, err := s.repo.GetProviderSecret(ctx, workspaceID, providerID); err != nil {
		return domain.ConsultationStarted{}, err
	}
	title := strings.TrimSpace(request.Title)
	if title == "" {
		runes := []rune(content)
		if len(runes) > 24 {
			runes = runes[:24]
		}
		title = agent.Agent.DisplayName + ": " + string(runes)
	}
	return s.repo.StartConsultation(ctx, workspaceID, agent.Agent.ID, providerID, title, content)
}

func (s *FocusRoomService) Sessions(ctx context.Context, workspaceID string, request ListFocusSessionsRequest) (FocusSessionPage, error) {
	limit := request.Limit
	if limit == 0 {
		limit = defaultFocusSessionPageSize
	}
	if limit < 1 || limit > maximumFocusSessionPageSize {
		return FocusSessionPage{}, domain.ErrInvalidInput
	}
	cursor, err := decodeFocusSessionCursor(request.Cursor)
	if err != nil {
		return FocusSessionPage{}, domain.ErrInvalidInput
	}
	sessions, err := s.repo.ListFocusSessions(ctx, workspaceID, cursor, limit+1)
	if err != nil {
		return FocusSessionPage{}, err
	}
	hasMore := len(sessions) > limit
	if hasMore {
		sessions = sessions[:limit]
	}
	nextCursor := ""
	if hasMore && len(sessions) > 0 {
		nextCursor, err = encodeFocusSessionCursor(sessions[len(sessions)-1])
		if err != nil {
			return FocusSessionPage{}, err
		}
	}
	return FocusSessionPage{Sessions: sessions, NextCursor: nextCursor, HasMore: hasMore}, nil
}

func decodeFocusSessionCursor(value string) (*domain.FocusSessionCursor, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}
	var payload focusSessionCursorPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	if payload.LastActivityAt.IsZero() || payload.CreatedAt.IsZero() || !isUUID(payload.ID) {
		return nil, domain.ErrInvalidInput
	}
	return &domain.FocusSessionCursor{LastActivityAt: payload.LastActivityAt, CreatedAt: payload.CreatedAt, ID: strings.ToLower(payload.ID)}, nil
}

func encodeFocusSessionCursor(session domain.FocusSessionSummary) (string, error) {
	payload := focusSessionCursorPayload{LastActivityAt: session.LastActivityAt, CreatedAt: session.CreatedAt, ID: session.ID}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func isUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return false
			}
			continue
		}
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f') || (character >= 'A' && character <= 'F')) {
			return false
		}
	}
	return true
}

func (s *FocusRoomService) Messages(ctx context.Context, workspaceID string, sessionID string) ([]domain.Message, error) {
	return s.repo.ListMessages(ctx, workspaceID, sessionID)
}

func (s *FocusRoomService) RenameSession(ctx context.Context, workspaceID string, sessionID string, title string) (domain.Session, error) {
	sessionID = strings.TrimSpace(sessionID)
	title = strings.TrimSpace(title)
	if sessionID == "" || title == "" {
		return domain.Session{}, domain.ErrInvalidInput
	}
	runes := []rune(title)
	if len(runes) > 80 {
		title = string(runes[:80])
	}
	return s.repo.RenameSession(ctx, workspaceID, sessionID, title)
}

func (s *FocusRoomService) DeleteSession(ctx context.Context, workspaceID string, sessionID string) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return domain.ErrInvalidInput
	}
	return s.repo.DeleteSession(ctx, workspaceID, sessionID)
}

func (s *FocusRoomService) StreamTurn(ctx context.Context, workspaceID string, turnID string, lastEventID string, emit func(StreamFrame) error) error {
	turn, err := s.repo.GetTurn(ctx, workspaceID, turnID)
	if err != nil {
		return err
	}
	after := parseLastSequence(lastEventID, turn.ID)
	replay, err := s.repo.ListSSEEventsAfter(ctx, turn.ID, after)
	if err != nil {
		return err
	}
	terminalSeen := false
	for _, event := range replay {
		if isTerminalEvent(event.EventType) {
			terminalSeen = true
		}
		if err := emit(StreamFrame{Event: event, Data: event.Payload}); err != nil {
			return err
		}
	}
	if terminalSeen || turn.Status == domain.TurnStatusCompleted || turn.Status == domain.TurnStatusFailed {
		return nil
	}
	return s.generateTurn(ctx, workspaceID, turn, emit)
}

func (s *FocusRoomService) generateTurn(ctx context.Context, workspaceID string, turn domain.Turn, emit func(StreamFrame) error) error {
	session, err := s.repo.GetSession(ctx, workspaceID, turn.SessionID)
	if err != nil {
		return err
	}
	agent, err := s.repo.GetAgentWithCurrentVersion(ctx, workspaceID, session.AgentID)
	if err != nil {
		return err
	}
	provider, err := s.repo.GetProviderSecret(ctx, workspaceID, session.ProviderConfigID)
	if err != nil {
		return err
	}
	apiKey, err := s.box.Decrypt(provider.APIKeyCiphertext)
	if err != nil {
		return err
	}
	userMessage, err := s.repo.GetMessage(ctx, workspaceID, turn.UserMessageID)
	if err != nil {
		return err
	}
	assistant, err := s.repo.CreateAssistantMessage(ctx, workspaceID, turn.SessionID, turn.ID, session.AgentID)
	if err != nil {
		return err
	}
	if err := s.repo.SetTurnAssistantMessage(ctx, workspaceID, turn.ID, assistant.ID); err != nil {
		return err
	}
	if err := s.repo.UpdateTurnStatus(ctx, workspaceID, turn.ID, domain.TurnStatusStreaming); err != nil {
		return err
	}

	sequence, err := s.repo.NextSSESequence(ctx, turn.ID)
	if err != nil {
		return err
	}
	emitPersisted := func(eventType string, payload domain.SSEPayload) error {
		eventID := fmt.Sprintf("%s:%d", turn.ID, sequence)
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
		event, err := s.repo.InsertSSEEvent(ctx, workspaceID, turn.SessionID, turn.ID, eventID, sequence, eventType, data)
		if err != nil {
			return err
		}
		sequence++
		return emit(StreamFrame{Event: event, Data: data})
	}

	if err := emitPersisted(domain.SSEEventAssistantMessageCreated, domain.SSEPayload{}); err != nil {
		return err
	}
	recentMessages, err := s.repo.ListRecentMessages(ctx, workspaceID, turn.SessionID, focusContextMessageLimit)
	if err != nil {
		return err
	}
	messages := buildChatMessages(agent, recentMessages, userMessage)
	usage, err := s.llm.StreamChat(ctx, llm.ChatRequest{
		BaseURL:  provider.BaseURL,
		APIKey:   apiKey,
		Model:    provider.ChatModel,
		Messages: messages,
	}, func(delta string) error {
		if err := s.repo.AppendAssistantContent(ctx, workspaceID, assistant.ID, delta, domain.MessageStatusPartial); err != nil {
			return err
		}
		return emitPersisted(domain.SSEEventAssistantDelta, domain.SSEPayload{Delta: delta})
	})
	if err != nil {
		_ = s.repo.UpdateTurnStatus(ctx, workspaceID, turn.ID, domain.TurnStatusFailed)
		_ = s.repo.MarkAssistantMessageFailed(ctx, workspaceID, assistant.ID, err.Error())
		return emitPersisted(domain.SSEEventTurnFailed, domain.SSEPayload{Error: err.Error()})
	}
	if err := s.repo.AppendAssistantContent(ctx, workspaceID, assistant.ID, "", domain.MessageStatusDone); err != nil {
		return err
	}
	if err := s.repo.UpdateTurnStatus(ctx, workspaceID, turn.ID, domain.TurnStatusCompleted); err != nil {
		return err
	}
	return emitPersisted(domain.SSEEventTurnCompleted, domain.SSEPayload{Usage: &domain.TokenUsage{PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens}})
}

func buildChatMessages(agent domain.AgentWithVersion, history []domain.Message, currentUser domain.Message) []llm.Message {
	messages := []llm.Message{{Role: "system", Content: assembleSystemPrompt(agent)}}
	currentSeen := false
	for _, message := range history {
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		role := ""
		switch message.Role {
		case domain.MessageRoleUser:
			role = "user"
		case domain.MessageRoleAssistant:
			role = "assistant"
		default:
			continue
		}
		if message.ID == currentUser.ID {
			currentSeen = true
		}
		messages = append(messages, llm.Message{Role: role, Content: content})
	}
	if !currentSeen && strings.TrimSpace(currentUser.Content) != "" {
		messages = append(messages, llm.Message{Role: "user", Content: strings.TrimSpace(currentUser.Content)})
	}
	return messages
}

func assembleSystemPrompt(agent domain.AgentWithVersion) string {
	name := strings.TrimSpace(agent.Agent.DisplayName)
	if name == "" {
		name = "当前智囊"
	}
	slug := strings.TrimSpace(agent.Agent.Slug)
	if slug == "" {
		slug = "advisor"
	}
	parts := []string{
		fmt.Sprintf(
			"你现在不是通用助手，也不是 Codex、ChatGPT、Claude 或任何底层模型身份。你正在 Sauna 中加载名为《%s》的 nuwa-skill 智囊。用户问“你是谁/介绍一下自己/你是什么模型”时，必须用《%s》的 skill 身份回答：说明你是基于公开资料和用户配置蒸馏出的《%s》视角智囊，非本人观点；禁止回答自己是 Codex、ChatGPT、OpenAI 模型或编程助手。",
			name,
			name,
			name,
		),
		fmt.Sprintf("当前 Agent 标识：display_name=%s, slug=%s。", name, slug),
		strings.TrimSpace(agent.Version.SystemPrompt),
		"你是一个被蒸馏成 skill 的 AI 智囊成员。必须遵循下面 Skill 的认知框架、表达 DNA、决策启发式、反模式和诚实边界；必须承认这是基于公开资料和用户配置模拟的思维方式，不代表本人。",
		"# Loaded nuwa-skill\n" + strings.TrimSpace(agent.Version.SkillMarkdown),
	}
	return strings.Join(parts, "\n\n")
}

func parseLastSequence(lastEventID string, turnID string) int {
	lastEventID = strings.TrimSpace(lastEventID)
	if lastEventID == "" {
		return 0
	}
	prefix := turnID + ":"
	if !strings.HasPrefix(lastEventID, prefix) {
		return 0
	}
	value, err := strconv.Atoi(strings.TrimPrefix(lastEventID, prefix))
	if err != nil {
		return 0
	}
	return value
}

func isTerminalEvent(eventType string) bool {
	switch eventType {
	case domain.SSEEventTurnCompleted, domain.SSEEventTurnFailed:
		return true
	default:
		return false
	}
}
