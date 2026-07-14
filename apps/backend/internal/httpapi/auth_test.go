package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"sauna/backend/internal/cache"
	"sauna/backend/internal/domain"
	"sauna/backend/internal/service"
)

func TestAuthStartProductionResponseOmitsDevCode(t *testing.T) {
	response := performAuthStart(t, "production")
	if _, ok := response["dev_code"]; ok {
		t.Fatalf("production response must omit dev_code: %#v", response)
	}
	if response["email"] != "user@example.com" {
		t.Fatalf("unexpected email response: %#v", response)
	}
}

func TestAuthStartDevelopmentResponseIncludesDevCode(t *testing.T) {
	response := performAuthStart(t, "development")
	if code, ok := response["dev_code"].(string); !ok || code == "" {
		t.Fatalf("development response must include dev_code: %#v", response)
	}
}

func performAuthStart(t *testing.T, appEnv string) map[string]any {
	t.Helper()
	store := cache.NewFakeStore()
	auth := service.NewAuthService(authTestRepo{}, store, store, authTestSender{}, time.Minute, time.Hour, appEnv, 5, 20)
	router := NewRouter(Services{Auth: auth})
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/email/start", bytes.NewBufferString(`{"email":"user@example.com"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return response
}

type authTestSender struct{}

func (authTestSender) SendVerificationCode(_ context.Context, _ string, _ string, _ time.Duration) error {
	return nil
}

type authTestRepo struct{}

func (authTestRepo) UpsertUserWorkspace(_ context.Context, email string) (domain.AuthIdentity, error) {
	return domain.AuthIdentity{User: domain.User{ID: "user-1", Email: email}, Workspace: domain.Workspace{ID: "workspace-1", OwnerUserID: "user-1"}}, nil
}

func (authTestRepo) CreateAuthSession(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func (authTestRepo) GetIdentityByTokenHash(_ context.Context, _ string) (domain.AuthIdentity, error) {
	return domain.AuthIdentity{}, domain.ErrNotFound
}

func (authTestRepo) RevokeAuthSession(_ context.Context, _ string) error {
	return nil
}
