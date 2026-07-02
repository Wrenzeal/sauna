package service

import (
	"context"
	"strings"

	secretcrypto "sauna/backend/internal/crypto"
	"sauna/backend/internal/domain"
	"sauna/backend/internal/llm"
)

type ProviderTester interface {
	TestProvider(ctx context.Context, baseURL string, apiKey string) error
}

type ProviderModelLister interface {
	ListModels(ctx context.Context, baseURL string, apiKey string) ([]llm.Model, error)
}

type ProviderChatTester interface {
	TestChat(ctx context.Context, request llm.ChatRequest) (llm.TestChatResult, error)
}

type ProviderService struct {
	repo   ProviderRepository
	box    secretcrypto.SecretBox
	tester ProviderTester
	models ProviderModelLister
	chat   ProviderChatTester
}

type CreateProviderInput struct {
	WorkspaceID      string
	ProviderName     string
	BaseURL          string
	APIKeyCiphertext string
	APIKeyHint       string
	ChatModel        string
	EmbeddingModel   string
	IsDefault        bool
}

type UpdateProviderInput struct {
	WorkspaceID      string
	ProviderConfigID string
	ProviderName     string
	BaseURL          string
	APIKeyCiphertext *string
	APIKeyHint       *string
	ChatModel        string
	EmbeddingModel   string
	IsDefault        bool
}

type CreateProviderRequest struct {
	ProviderName   string `json:"provider_name"`
	BaseURL        string `json:"base_url"`
	APIKey         string `json:"api_key"`
	ChatModel      string `json:"chat_model"`
	EmbeddingModel string `json:"embedding_model"`
	IsDefault      bool   `json:"is_default"`
}

type UpdateProviderRequest struct {
	ProviderName   string `json:"provider_name"`
	BaseURL        string `json:"base_url"`
	APIKey         string `json:"api_key"`
	ChatModel      string `json:"chat_model"`
	EmbeddingModel string `json:"embedding_model"`
	IsDefault      bool   `json:"is_default"`
}

type DiscoverModelsRequest struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

func NewProviderService(repo ProviderRepository, box secretcrypto.SecretBox, tester ProviderTester) *ProviderService {
	svc := &ProviderService{repo: repo, box: box, tester: tester}
	if client, ok := tester.(ProviderModelLister); ok {
		svc.models = client
	}
	if client, ok := tester.(ProviderChatTester); ok {
		svc.chat = client
	}
	return svc
}

func (s *ProviderService) Create(ctx context.Context, workspaceID string, request CreateProviderRequest) (domain.ProviderConfig, error) {
	if strings.TrimSpace(request.ProviderName) == "" || strings.TrimSpace(request.BaseURL) == "" || strings.TrimSpace(request.APIKey) == "" || strings.TrimSpace(request.ChatModel) == "" {
		return domain.ProviderConfig{}, domain.ErrInvalidInput
	}
	sealed, err := s.box.Encrypt(request.APIKey)
	if err != nil {
		return domain.ProviderConfig{}, err
	}
	return s.repo.CreateProviderConfig(ctx, CreateProviderInput{
		WorkspaceID:      workspaceID,
		ProviderName:     strings.TrimSpace(request.ProviderName),
		BaseURL:          normalizeBaseURL(request.BaseURL),
		APIKeyCiphertext: sealed,
		APIKeyHint:       secretcrypto.MaskSecret(request.APIKey),
		ChatModel:        strings.TrimSpace(request.ChatModel),
		EmbeddingModel:   strings.TrimSpace(request.EmbeddingModel),
		IsDefault:        request.IsDefault,
	})
}

func (s *ProviderService) List(ctx context.Context, workspaceID string) ([]domain.ProviderConfig, error) {
	return s.repo.ListProviderConfigs(ctx, workspaceID)
}

func (s *ProviderService) Update(ctx context.Context, workspaceID string, providerConfigID string, request UpdateProviderRequest) (domain.ProviderConfig, error) {
	if strings.TrimSpace(providerConfigID) == "" || strings.TrimSpace(request.ProviderName) == "" || strings.TrimSpace(request.BaseURL) == "" || strings.TrimSpace(request.ChatModel) == "" {
		return domain.ProviderConfig{}, domain.ErrInvalidInput
	}
	input := UpdateProviderInput{
		WorkspaceID:      workspaceID,
		ProviderConfigID: providerConfigID,
		ProviderName:     strings.TrimSpace(request.ProviderName),
		BaseURL:          normalizeBaseURL(request.BaseURL),
		ChatModel:        strings.TrimSpace(request.ChatModel),
		EmbeddingModel:   strings.TrimSpace(request.EmbeddingModel),
		IsDefault:        request.IsDefault,
	}
	if strings.TrimSpace(request.APIKey) != "" {
		sealed, err := s.box.Encrypt(request.APIKey)
		if err != nil {
			return domain.ProviderConfig{}, err
		}
		masked := secretcrypto.MaskSecret(request.APIKey)
		input.APIKeyCiphertext = &sealed
		input.APIKeyHint = &masked
	}
	return s.repo.UpdateProviderConfig(ctx, input)
}

func (s *ProviderService) Delete(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error) {
	if strings.TrimSpace(providerConfigID) == "" {
		return domain.ProviderConfig{}, domain.ErrInvalidInput
	}
	return s.repo.DeleteProviderConfig(ctx, workspaceID, providerConfigID)
}

func (s *ProviderService) SetDefault(ctx context.Context, workspaceID string, providerConfigID string) (domain.ProviderConfig, error) {
	return s.repo.SetDefaultProviderConfig(ctx, workspaceID, providerConfigID)
}

func (s *ProviderService) Test(ctx context.Context, workspaceID string, providerConfigID string) error {
	secret, err := s.repo.GetProviderSecret(ctx, workspaceID, providerConfigID)
	if err != nil {
		return err
	}
	apiKey, err := s.box.Decrypt(secret.APIKeyCiphertext)
	if err != nil {
		return err
	}
	if s.tester != nil {
		if err := s.tester.TestProvider(ctx, secret.BaseURL, apiKey); err != nil {
			_ = s.repo.MarkProviderTested(ctx, workspaceID, providerConfigID, "failed")
			return err
		}
	}
	return s.repo.MarkProviderTested(ctx, workspaceID, providerConfigID, "active")
}

func (s *ProviderService) Models(ctx context.Context, workspaceID string, providerConfigID string) ([]llm.Model, error) {
	if s.models == nil {
		return nil, domain.ErrInvalidInput
	}
	secret, err := s.repo.GetProviderSecret(ctx, workspaceID, providerConfigID)
	if err != nil {
		return nil, err
	}
	apiKey, err := s.box.Decrypt(secret.APIKeyCiphertext)
	if err != nil {
		return nil, err
	}
	return s.models.ListModels(ctx, secret.BaseURL, apiKey)
}

func (s *ProviderService) DiscoverModels(ctx context.Context, request DiscoverModelsRequest) ([]llm.Model, error) {
	if s.models == nil || strings.TrimSpace(request.BaseURL) == "" || strings.TrimSpace(request.APIKey) == "" {
		return nil, domain.ErrInvalidInput
	}
	return s.models.ListModels(ctx, normalizeBaseURL(request.BaseURL), request.APIKey)
}

func (s *ProviderService) TestChat(ctx context.Context, workspaceID string, providerConfigID string) (llm.TestChatResult, error) {
	if s.chat == nil {
		return llm.TestChatResult{}, domain.ErrInvalidInput
	}
	secret, err := s.repo.GetProviderSecret(ctx, workspaceID, providerConfigID)
	if err != nil {
		return llm.TestChatResult{}, err
	}
	apiKey, err := s.box.Decrypt(secret.APIKeyCiphertext)
	if err != nil {
		return llm.TestChatResult{}, err
	}
	result, err := s.chat.TestChat(ctx, llm.ChatRequest{
		BaseURL: secret.BaseURL,
		APIKey:  apiKey,
		Model:   secret.ChatModel,
		Messages: []llm.Message{
			{Role: "user", Content: "请用一句话回答: Sauna 模型接入测试。"},
		},
	})
	if err != nil {
		_ = s.repo.MarkProviderTested(ctx, workspaceID, providerConfigID, "failed")
		return llm.TestChatResult{}, err
	}
	_ = s.repo.MarkProviderTested(ctx, workspaceID, providerConfigID, "active")
	return result, nil
}

func normalizeBaseURL(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}
