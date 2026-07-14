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
	if response["resend_after_seconds"] != float64(60) {
		t.Fatalf("expected resend metadata: %#v", response)
	}
}

func TestAuthStartDevelopmentResponseIncludesDevCode(t *testing.T) {
	response := performAuthStart(t, "development")
	if code, ok := response["dev_code"].(string); !ok || code == "" {
		t.Fatalf("development response must include dev_code: %#v", response)
	}
}

func TestAuthStartCooldownReturnsRetryAfter(t *testing.T) {
	store := cache.NewFakeStore()
	auth := service.NewAuthService(authTestRepo{}, store, store, authTestSender{}, time.Minute, time.Hour, time.Minute, "production", 5, 20)
	router := NewRouter(Services{Auth: auth})

	for attempt := 1; attempt <= 2; attempt++ {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/email/start", bytes.NewBufferString(`{"email":"user@example.com"}`))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		if attempt == 1 && recorder.Code != http.StatusOK {
			t.Fatalf("first request expected 200, got %d: %s", recorder.Code, recorder.Body.String())
		}
		if attempt == 2 {
			if recorder.Code != http.StatusTooManyRequests {
				t.Fatalf("second request expected 429, got %d: %s", recorder.Code, recorder.Body.String())
			}
			var payload map[string]any
			if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode cooldown response: %v", err)
			}
			if payload["error"] != "verification_code_cooldown" || payload["retry_after_seconds"].(float64) < 1 {
				t.Fatalf("unexpected cooldown payload: %#v", payload)
			}
		}
	}
}

func TestAuthVerifyInvalidCodeHasDedicatedError(t *testing.T) {
	store := cache.NewFakeStore()
	auth := service.NewAuthService(authTestRepo{}, store, store, authTestSender{}, time.Minute, time.Hour, time.Minute, "production", 5, 20)
	router := NewRouter(Services{Auth: auth})
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/email/verify", bytes.NewBufferString(`{"email":"user@example.com","code":"000000"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode invalid-code response: %v", err)
	}
	if payload["error"] != "invalid_verification_code" {
		t.Fatalf("unexpected invalid-code payload: %#v", payload)
	}
}

func performAuthStart(t *testing.T, appEnv string) map[string]any {
	t.Helper()
	store := cache.NewFakeStore()
	auth := service.NewAuthService(authTestRepo{}, store, store, authTestSender{}, time.Minute, time.Hour, time.Minute, appEnv, 5, 20)
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
