package service

import (
	"context"
	"testing"
	"time"

	secretcrypto "sauna/backend/internal/crypto"
	"sauna/backend/internal/domain"
)

func TestUpdateProviderKeepsExistingKeyWhenAPIKeyEmpty(t *testing.T) {
	box := secretcrypto.NewSecretBox("test-secret")
	existing, err := box.Encrypt("sk-existing")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	repo := &fakeProviderRepo{provider: domain.ProviderConfig{ID: "provider-1", WorkspaceID: "workspace-1", MaskedAPIKey: "sk-e...ting", CreatedAt: time.Now(), UpdatedAt: time.Now()}, ciphertext: existing}
	svc := NewProviderService(repo, box, nil)

	provider, err := svc.Update(context.Background(), "workspace-1", "provider-1", UpdateProviderRequest{
		ProviderName:   " OpenAI Compatible ",
		BaseURL:        " https://api.example/v1/ ",
		ChatModel:      " gpt-test ",
		EmbeddingModel: " embed-test ",
		APIKey:         "   ",
		IsDefault:      true,
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if repo.lastUpdate.APIKeyCiphertext != nil || repo.lastUpdate.APIKeyHint != nil {
		t.Fatal("expected empty api_key to keep existing secret")
	}
	if provider.MaskedAPIKey != "sk-e...ting" {
		t.Fatalf("masked key changed unexpectedly: %q", provider.MaskedAPIKey)
	}
	if provider.ProviderName != "OpenAI Compatible" || provider.BaseURL != "https://api.example/v1" || provider.ChatModel != "gpt-test" || !provider.IsDefault {
		t.Fatalf("unexpected provider update %#v", provider)
	}
}

func TestUpdateProviderEncryptsNewAPIKey(t *testing.T) {
	box := secretcrypto.NewSecretBox("test-secret")
	repo := &fakeProviderRepo{provider: domain.ProviderConfig{ID: "provider-1", WorkspaceID: "workspace-1"}}
	svc := NewProviderService(repo, box, nil)

	_, err := svc.Update(context.Background(), "workspace-1", "provider-1", UpdateProviderRequest{ProviderName: "p", BaseURL: "https://api.example/v1", ChatModel: "gpt", APIKey: "sk-new-secret"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if repo.lastUpdate.APIKeyCiphertext == nil || repo.lastUpdate.APIKeyHint == nil {
		t.Fatal("expected new api key fields")
	}
	if *repo.lastUpdate.APIKeyCiphertext == "sk-new-secret" {
		t.Fatal("plaintext api key stored as ciphertext")
	}
	plain, err := box.Decrypt(*repo.lastUpdate.APIKeyCiphertext)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if plain != "sk-new-secret" {
		t.Fatalf("unexpected decrypted key %q", plain)
	}
	if *repo.lastUpdate.APIKeyHint != "sk-n...cret" {
		t.Fatalf("unexpected mask %q", *repo.lastUpdate.APIKeyHint)
	}
}

type fakeProviderRepo struct {
	provider   domain.ProviderConfig
	ciphertext string
	lastUpdate UpdateProviderInput
}

func (f *fakeProviderRepo) CreateProviderConfig(context.Context, CreateProviderInput) (domain.ProviderConfig, error) {
	return domain.ProviderConfig{}, nil
}

func (f *fakeProviderRepo) ListProviderConfigs(context.Context, string) ([]domain.ProviderConfig, error) {
	return nil, nil
}

func (f *fakeProviderRepo) UpdateProviderConfig(_ context.Context, input UpdateProviderInput) (domain.ProviderConfig, error) {
	f.lastUpdate = input
	provider := f.provider
	provider.WorkspaceID = input.WorkspaceID
	provider.ID = input.ProviderConfigID
	provider.ProviderName = input.ProviderName
	provider.BaseURL = input.BaseURL
	provider.ChatModel = input.ChatModel
	provider.EmbeddingModel = input.EmbeddingModel
	provider.IsDefault = input.IsDefault
	if input.APIKeyHint != nil {
		provider.MaskedAPIKey = *input.APIKeyHint
	}
	return provider, nil
}

func (f *fakeProviderRepo) DeleteProviderConfig(context.Context, string, string) (domain.ProviderConfig, error) {
	return domain.ProviderConfig{}, nil
}

func (f *fakeProviderRepo) GetProviderSecret(context.Context, string, string) (domain.ProviderSecret, error) {
	return domain.ProviderSecret{ProviderConfig: f.provider, APIKeyCiphertext: f.ciphertext}, nil
}

func (f *fakeProviderRepo) GetDefaultProviderSecret(context.Context, string) (domain.ProviderSecret, error) {
	return domain.ProviderSecret{}, nil
}

func (f *fakeProviderRepo) SetDefaultProviderConfig(context.Context, string, string) (domain.ProviderConfig, error) {
	return domain.ProviderConfig{}, nil
}

func (f *fakeProviderRepo) MarkProviderTested(context.Context, string, string, string) error {
	return nil
}
