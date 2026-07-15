package service

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	secretcrypto "sauna/backend/internal/crypto"
	"sauna/backend/internal/domain"
	"sauna/backend/internal/llm"
)

func TestCreateSessionUsesUserProviderForPublicAgent(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	session, err := svc.CreateSession(context.Background(), repo.workspaceID, CreateSessionRequest{AgentID: repo.agent.Agent.ID})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if session.ProviderConfigID != repo.provider.ID {
		t.Fatalf("expected user default provider %s, got %s", repo.provider.ID, session.ProviderConfigID)
	}
	if !repo.defaultProviderRequested {
		t.Fatal("expected default provider lookup")
	}
}

func TestCreateSessionRequiresProviderWhenLoggedInUserHasNone(t *testing.T) {
	repo := newFakeFocusRepo(t)
	repo.providerMissing = true
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	_, err := svc.CreateSession(context.Background(), repo.workspaceID, CreateSessionRequest{AgentID: repo.agent.Agent.ID})
	if !errors.Is(err, domain.ErrProviderConfigRequired) {
		t.Fatalf("expected provider_config_required, got %v", err)
	}
}

func TestStartConsultationCreatesSessionAndFirstTurn(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	result, err := svc.StartConsultation(context.Background(), repo.workspaceID, StartConsultationRequest{AgentID: repo.agent.Agent.ID, Content: "  我该怎么做产品？  "})
	if err != nil {
		t.Fatalf("StartConsultation: %v", err)
	}
	if result.Session.ID != repo.session.ID || result.Turn.ID != repo.turn.ID {
		t.Fatalf("unexpected result %#v", result)
	}
	if result.UserMessage.Content != "我该怎么做产品？" {
		t.Fatalf("content was not trimmed: %q", result.UserMessage.Content)
	}
	if result.Session.Title == "" {
		t.Fatalf("expected generated title")
	}
}

func TestSessionsExposeBoundProviderConfig(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	sessions, err := svc.Sessions(context.Background(), repo.workspaceID)
	if err != nil {
		t.Fatalf("Sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].ProviderConfigID != repo.session.ProviderConfigID {
		t.Fatalf("expected bound provider %s, got %#v", repo.session.ProviderConfigID, sessions)
	}
}

func TestStartConsultationRejectsEmptyContent(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	_, err := svc.StartConsultation(context.Background(), repo.workspaceID, StartConsultationRequest{AgentID: repo.agent.Agent.ID, Content: "   "})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestRetryTurnRequiresFailedTurnAndReusesIt(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})
	if _, err := svc.RetryTurn(context.Background(), repo.workspaceID, repo.session.ID, repo.turn.ID); !errors.Is(err, domain.ErrTurnNotRetryable) {
		t.Fatalf("expected turn_not_retryable, got %v", err)
	}
	repo.turn.Status = domain.TurnStatusFailed
	turn, err := svc.RetryTurn(context.Background(), repo.workspaceID, repo.session.ID, repo.turn.ID)
	if err != nil {
		t.Fatalf("RetryTurn: %v", err)
	}
	if turn.ID != repo.turn.ID || turn.Status != domain.TurnStatusCreated || turn.UserMessageID != repo.userMessage.ID {
		t.Fatalf("unexpected retried turn %#v", turn)
	}
}

func TestStreamTurnPersistsFailureOnAssistantMessage(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{err: errors.New("upstream unavailable")})
	if err := svc.StreamTurn(context.Background(), repo.workspaceID, repo.turn.ID, "", func(StreamFrame) error { return nil }); err != nil {
		t.Fatalf("StreamTurn: %v", err)
	}
	if repo.turn.Status != domain.TurnStatusFailed || repo.assistant.Status != domain.MessageStatusFailed || repo.assistant.Error != "upstream unavailable" {
		t.Fatalf("failure was not persisted: turn=%#v assistant=%#v", repo.turn, repo.assistant)
	}
}

func TestStreamTurnPersistsSequencedTerminalEvents(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{chunks: []string{"先聚焦", "，再验证"}})

	var frames []StreamFrame
	err := svc.StreamTurn(context.Background(), repo.workspaceID, repo.turn.ID, "", func(frame StreamFrame) error {
		frames = append(frames, frame)
		return nil
	})
	if err != nil {
		t.Fatalf("StreamTurn: %v", err)
	}
	if len(frames) != 4 {
		t.Fatalf("expected 4 frames, got %d", len(frames))
	}
	for i, frame := range frames {
		want := i + 1
		if frame.Event.Sequence != want {
			t.Fatalf("frame %d expected seq %d got %d", i, want, frame.Event.Sequence)
		}
		wantEventID := repo.turn.ID + ":" + strconv.Itoa(want)
		if frame.Event.EventID != wantEventID {
			t.Fatalf("expected event id %s got %s", wantEventID, frame.Event.EventID)
		}
		var payload domain.SSEPayload
		if err := json.Unmarshal(frame.Data, &payload); err != nil {
			t.Fatalf("payload json: %v", err)
		}
		if payload.EventID != frame.Event.EventID || payload.Sequence != frame.Event.Sequence {
			t.Fatalf("payload/event mismatch: %#v %#v", payload, frame.Event)
		}
	}
	if frames[len(frames)-1].Event.EventType != domain.SSEEventTurnCompleted {
		t.Fatalf("expected terminal completed event, got %s", frames[len(frames)-1].Event.EventType)
	}
	if repo.turn.Status != domain.TurnStatusCompleted {
		t.Fatalf("expected completed turn, got %s", repo.turn.Status)
	}
	if repo.assistantContent != "先聚焦，再验证" {
		t.Fatalf("unexpected assistant content %q", repo.assistantContent)
	}
}

func TestStreamTurnSystemPromptPinsSelectedAgentSkillIdentity(t *testing.T) {
	repo := newFakeFocusRepo(t)
	repo.agent.Version.SystemPrompt = "系统设定：像乔布斯一样先做减法。"
	repo.agent.Version.SkillMarkdown = "# Steve Jobs · 思维操作系统\n\n## 角色扮演规则\n直接以Steve Jobs的身份回应。"
	var sent []llm.Message
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{chunks: []string{"ok"}, messages: &sent})

	err := svc.StreamTurn(context.Background(), repo.workspaceID, repo.turn.ID, "", func(StreamFrame) error { return nil })
	if err != nil {
		t.Fatalf("StreamTurn: %v", err)
	}
	if len(sent) == 0 || sent[0].Role != "system" {
		t.Fatalf("expected first system prompt, got %#v", sent)
	}
	system := sent[0].Content
	for _, want := range []string{"乔布斯", "不是 Codex", "禁止回答自己是 Codex", "# Loaded nuwa-skill", "Steve Jobs · 思维操作系统", "系统设定：像乔布斯一样先做减法"} {
		if !strings.Contains(system, want) {
			t.Fatalf("system prompt missing %q in:\n%s", want, system)
		}
	}
}

func TestStreamTurnIncludesRecentSessionMessages(t *testing.T) {
	repo := newFakeFocusRepo(t)
	now := time.Now().UTC()
	assistantAgentID := repo.agent.Agent.ID
	repo.history = []domain.Message{
		{ID: "history-user", WorkspaceID: repo.workspaceID, SessionID: repo.session.ID, TurnID: "turn-1", Role: domain.MessageRoleUser, Content: "上文问题", Status: domain.MessageStatusDone, CreatedAt: now.Add(-3 * time.Minute)},
		{ID: "history-assistant", WorkspaceID: repo.workspaceID, SessionID: repo.session.ID, TurnID: "turn-1", AgentID: &assistantAgentID, Role: domain.MessageRoleAssistant, Content: "上文回答", Status: domain.MessageStatusDone, CreatedAt: now.Add(-2 * time.Minute)},
		{ID: repo.userMessage.ID, WorkspaceID: repo.workspaceID, SessionID: repo.session.ID, TurnID: repo.turn.ID, Role: domain.MessageRoleUser, Content: "当前问题", Status: domain.MessageStatusDone, CreatedAt: now.Add(-1 * time.Minute)},
	}
	var sent []llm.Message
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{chunks: []string{"ok"}, messages: &sent})

	err := svc.StreamTurn(context.Background(), repo.workspaceID, repo.turn.ID, "", func(StreamFrame) error { return nil })
	if err != nil {
		t.Fatalf("StreamTurn: %v", err)
	}
	if len(sent) != 4 {
		t.Fatalf("expected system plus 3 history messages, got %#v", sent)
	}
	if sent[1].Role != "user" || sent[1].Content != "上文问题" || sent[2].Role != "assistant" || sent[2].Content != "上文回答" || sent[3].Role != "user" || sent[3].Content != "当前问题" {
		t.Fatalf("unexpected message history %#v", sent)
	}
}

func TestRenameSessionTrimsAndLimitsTitle(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	longTitle := "  " + strings.Repeat("名", 90) + "  "
	session, err := svc.RenameSession(context.Background(), repo.workspaceID, repo.session.ID, longTitle)
	if err != nil {
		t.Fatalf("RenameSession: %v", err)
	}
	if got := len([]rune(session.Title)); got != 80 {
		t.Fatalf("expected title length 80, got %d", got)
	}
}

func TestRenameSessionRejectsEmptyTitle(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	_, err := svc.RenameSession(context.Background(), repo.workspaceID, repo.session.ID, "   ")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestDeleteSessionDelegatesToRepository(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	if err := svc.DeleteSession(context.Background(), repo.workspaceID, repo.session.ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}
	if !repo.sessionDeleted {
		t.Fatal("expected repository delete")
	}
}

func TestSessionsReturnsFocusSummaries(t *testing.T) {
	repo := newFakeFocusRepo(t)
	svc := NewFocusRoomService(repo, repo.box, fakeLLM{})

	sessions, err := svc.Sessions(context.Background(), repo.workspaceID)
	if err != nil {
		t.Fatalf("Sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].ID != repo.session.ID || sessions[0].LastMessagePreview == "" {
		t.Fatalf("unexpected sessions %#v", sessions)
	}
}

type fakeFocusRepo struct {
	workspaceID              string
	agent                    domain.AgentWithVersion
	provider                 domain.ProviderSecret
	providerMissing          bool
	defaultProviderRequested bool
	session                  domain.Session
	turn                     domain.Turn
	userMessage              domain.Message
	assistant                domain.Message
	assistantContent         string
	history                  []domain.Message
	summaries                []domain.FocusSessionSummary
	events                   []domain.SSEEvent
	sessionDeleted           bool
	box                      secretcrypto.SecretBox
}

func newFakeFocusRepo(t *testing.T) *fakeFocusRepo {
	t.Helper()
	box := secretcrypto.NewSecretBox("test-secret")
	sealed, err := box.Encrypt("sk-user-provider")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	workspaceID := "11111111-1111-1111-1111-111111111111"
	agentID := "22222222-2222-2222-2222-222222222222"
	versionID := "33333333-3333-3333-3333-333333333333"
	sessionID := "44444444-4444-4444-4444-444444444444"
	turnID := "55555555-5555-5555-5555-555555555555"
	userMessageID := "66666666-6666-6666-6666-666666666666"
	assistantID := "77777777-7777-7777-7777-777777777777"
	providerID := "88888888-8888-8888-8888-888888888888"
	now := time.Now().UTC()
	return &fakeFocusRepo{
		workspaceID: workspaceID,
		box:         box,
		agent: domain.AgentWithVersion{
			Agent:   domain.Agent{ID: agentID, DisplayName: "乔布斯", Slug: "steve-jobs", IsPublicTemplate: true, CurrentVersionID: versionID, CreatedAt: now, UpdatedAt: now},
			Version: domain.AgentVersion{ID: versionID, AgentID: agentID, VersionNo: 1, SystemPrompt: "聚焦", SkillMarkdown: "# Skill", Status: "published", CreatedAt: now},
		},
		provider:    domain.ProviderSecret{ProviderConfig: domain.ProviderConfig{ID: providerID, WorkspaceID: workspaceID, ProviderName: "openai-compatible", BaseURL: "https://llm.example/v1", ChatModel: "test-model", MaskedAPIKey: "sk-u...ider", IsDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now}, APIKeyCiphertext: sealed},
		session:     domain.Session{ID: sessionID, WorkspaceID: workspaceID, SessionType: domain.SessionTypeFocus, Title: "乔布斯 的 VIP 桑拿房", CurrentStatus: "active", AgentID: agentID, AgentVersionID: versionID, ProviderConfigID: providerID, CreatedAt: now, UpdatedAt: now},
		turn:        domain.Turn{ID: turnID, WorkspaceID: workspaceID, SessionID: sessionID, InteractionID: "99999999-9999-9999-9999-999999999999", UserMessageID: userMessageID, Status: domain.TurnStatusCreated, CreatedAt: now, UpdatedAt: now},
		userMessage: domain.Message{ID: userMessageID, WorkspaceID: workspaceID, SessionID: sessionID, TurnID: turnID, Role: domain.MessageRoleUser, Content: "我该做什么？", Status: domain.MessageStatusDone, CreatedAt: now},
		assistant:   domain.Message{ID: assistantID, WorkspaceID: workspaceID, SessionID: sessionID, TurnID: turnID, AgentID: &agentID, Role: domain.MessageRoleAssistant, Status: domain.MessageStatusPending, CreatedAt: now},
	}
}

func (f *fakeFocusRepo) GetAgentWithCurrentVersion(_ context.Context, _ string, _ string) (domain.AgentWithVersion, error) {
	return f.agent, nil
}

func (f *fakeFocusRepo) GetDefaultProviderSecret(_ context.Context, _ string) (domain.ProviderSecret, error) {
	f.defaultProviderRequested = true
	if f.providerMissing {
		return domain.ProviderSecret{}, domain.ErrNotFound
	}
	return f.provider, nil
}

func (f *fakeFocusRepo) GetProviderSecret(_ context.Context, _ string, _ string) (domain.ProviderSecret, error) {
	if f.providerMissing {
		return domain.ProviderSecret{}, domain.ErrNotFound
	}
	return f.provider, nil
}

func (f *fakeFocusRepo) CreateFocusSession(_ context.Context, workspaceID string, agentID string, providerConfigID string, title string) (domain.Session, error) {
	f.session.WorkspaceID = workspaceID
	f.session.AgentID = agentID
	f.session.ProviderConfigID = providerConfigID
	f.session.Title = title
	return f.session, nil
}

func (f *fakeFocusRepo) StartConsultation(_ context.Context, workspaceID string, agentID string, providerConfigID string, title string, content string) (domain.ConsultationStarted, error) {
	f.session.WorkspaceID = workspaceID
	f.session.AgentID = agentID
	f.session.ProviderConfigID = providerConfigID
	f.session.Title = title
	f.turn.SessionID = f.session.ID
	f.userMessage.SessionID = f.session.ID
	f.userMessage.TurnID = f.turn.ID
	f.userMessage.Content = content
	return domain.ConsultationStarted{Session: f.session, Turn: f.turn, UserMessage: f.userMessage}, nil
}

func (f *fakeFocusRepo) ListFocusSessions(_ context.Context, _ string) ([]domain.FocusSessionSummary, error) {
	if f.summaries != nil {
		return f.summaries, nil
	}
	return []domain.FocusSessionSummary{{ID: f.session.ID, WorkspaceID: f.session.WorkspaceID, SessionType: f.session.SessionType, Title: f.session.Title, CurrentStatus: f.session.CurrentStatus, AgentID: f.session.AgentID, ProviderConfigID: f.session.ProviderConfigID, AgentDisplayName: f.agent.Agent.DisplayName, AgentAvatarEmoji: f.agent.Agent.AvatarEmoji, LastMessagePreview: f.userMessage.Content, LastActivityAt: f.session.UpdatedAt, CreatedAt: f.session.CreatedAt, UpdatedAt: f.session.UpdatedAt}}, nil
}

func (f *fakeFocusRepo) GetSession(_ context.Context, _ string, _ string) (domain.Session, error) {
	return f.session, nil
}

func (f *fakeFocusRepo) RenameSession(_ context.Context, _ string, _ string, title string) (domain.Session, error) {
	f.session.Title = title
	return f.session, nil
}

func (f *fakeFocusRepo) DeleteSession(_ context.Context, _ string, _ string) error {
	f.sessionDeleted = true
	return nil
}

func (f *fakeFocusRepo) CreateTurn(_ context.Context, _ string, _ string, content string) (domain.TurnCreated, error) {
	f.userMessage.Content = content
	return domain.TurnCreated{Turn: f.turn, UserMessage: f.userMessage}, nil
}

func (f *fakeFocusRepo) RetryTurn(_ context.Context, _ string, _ string, _ string) (domain.Turn, error) {
	if f.turn.Status != domain.TurnStatusFailed {
		return domain.Turn{}, domain.ErrTurnNotRetryable
	}
	f.turn.Status = domain.TurnStatusCreated
	f.turn.AssistantMessageID = nil
	return f.turn, nil
}

func (f *fakeFocusRepo) GetTurn(_ context.Context, _ string, _ string) (domain.Turn, error) {
	return f.turn, nil
}

func (f *fakeFocusRepo) GetMessage(_ context.Context, _ string, messageID string) (domain.Message, error) {
	if messageID == f.userMessage.ID {
		return f.userMessage, nil
	}
	if messageID == f.assistant.ID {
		return f.assistant, nil
	}
	return domain.Message{}, domain.ErrNotFound
}

func (f *fakeFocusRepo) CreateAssistantMessage(_ context.Context, _ string, _ string, _ string, _ string) (domain.Message, error) {
	return f.assistant, nil
}

func (f *fakeFocusRepo) SetTurnAssistantMessage(_ context.Context, _ string, _ string, messageID string) error {
	f.turn.AssistantMessageID = &messageID
	return nil
}

func (f *fakeFocusRepo) AppendAssistantContent(_ context.Context, _ string, _ string, delta string, status string) error {
	f.assistantContent += delta
	f.assistant.Status = status
	return nil
}

func (f *fakeFocusRepo) MarkAssistantMessageFailed(_ context.Context, _ string, _ string, errorMessage string) error {
	f.assistant.Status = domain.MessageStatusFailed
	f.assistant.Error = errorMessage
	return nil
}

func (f *fakeFocusRepo) UpdateTurnStatus(_ context.Context, _ string, _ string, status string) error {
	f.turn.Status = status
	return nil
}

func (f *fakeFocusRepo) ListMessages(_ context.Context, _ string, _ string) ([]domain.Message, error) {
	return []domain.Message{f.userMessage, f.assistant}, nil
}

func (f *fakeFocusRepo) ListRecentMessages(_ context.Context, _ string, _ string, _ int) ([]domain.Message, error) {
	if f.history != nil {
		return f.history, nil
	}
	return []domain.Message{f.userMessage}, nil
}

func (f *fakeFocusRepo) NextSSESequence(_ context.Context, _ string) (int, error) {
	return len(f.events) + 1, nil
}

func (f *fakeFocusRepo) InsertSSEEvent(_ context.Context, _ string, _ string, _ string, eventID string, sequence int, eventType string, payload []byte) (domain.SSEEvent, error) {
	event := domain.SSEEvent{ID: eventID, EventID: eventID, Sequence: sequence, EventType: eventType, Payload: payload, CreatedAt: time.Now().UTC()}
	f.events = append(f.events, event)
	return event, nil
}

func (f *fakeFocusRepo) ListSSEEventsAfter(_ context.Context, _ string, afterSequence int) ([]domain.SSEEvent, error) {
	var out []domain.SSEEvent
	for _, event := range f.events {
		if event.Sequence > afterSequence {
			out = append(out, event)
		}
	}
	return out, nil
}

type fakeLLM struct {
	chunks   []string
	err      error
	messages *[]llm.Message
}

func (f fakeLLM) StreamChat(_ context.Context, request llm.ChatRequest, onDelta func(delta string) error) (llm.TokenUsage, error) {
	if f.messages != nil {
		*f.messages = append((*f.messages)[:0], request.Messages...)
	}
	chunks := f.chunks
	if len(chunks) == 0 {
		chunks = []string{"ok"}
	}
	for _, chunk := range chunks {
		if err := onDelta(chunk); err != nil {
			return llm.TokenUsage{}, err
		}
	}
	if f.err != nil {
		return llm.TokenUsage{}, f.err
	}
	return llm.TokenUsage{CompletionTokens: len(chunks), TotalTokens: len(chunks)}, nil
}
