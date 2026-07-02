package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"sauna/backend/internal/cache"
	"sauna/backend/internal/domain"
)

func TestStartEmailDevReturnsCodeAndSends(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, "development", 5, 20)

	result, err := svc.StartEmail(context.Background(), "  USER@Example.COM  ", "203.0.113.10")
	if err != nil {
		t.Fatalf("StartEmail: %v", err)
	}
	if result.Email != "user@example.com" {
		t.Fatalf("expected normalized email, got %q", result.Email)
	}
	if result.DevCode == "" {
		t.Fatal("expected dev code in development")
	}
	if sender.email != "user@example.com" || sender.code != result.DevCode || sender.ttl != time.Minute {
		t.Fatalf("unexpected sender call %#v", sender)
	}
	ok, err := store.VerifyEmailCode(context.Background(), "user@example.com", result.DevCode)
	if err != nil || !ok {
		t.Fatalf("expected stored verification code, ok=%v err=%v", ok, err)
	}
}

func TestStartEmailProductionHidesDevCodeAndSends(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, "production", 5, 20)

	result, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if err != nil {
		t.Fatalf("StartEmail: %v", err)
	}
	if result.DevCode != "" {
		t.Fatalf("production must not return dev code, got %q", result.DevCode)
	}
	if sender.email != "user@example.com" || sender.code == "" {
		t.Fatalf("expected sender call, got %#v", sender)
	}
}

func TestStartEmailDeliveryFailureReturnsDomainError(t *testing.T) {
	store := cache.NewFakeStore()
	svc := NewAuthService(&fakeAuthRepo{}, store, store, &fakeEmailSender{err: errors.New("smtp down")}, time.Minute, time.Hour, "production", 5, 20)

	_, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if !errors.Is(err, domain.ErrEmailDelivery) {
		t.Fatalf("expected email delivery error, got %v", err)
	}
}

func TestStartEmailRateLimitsEmailAndIP(t *testing.T) {
	store := cache.NewFakeStore()
	svc := NewAuthService(&fakeAuthRepo{}, store, store, &fakeEmailSender{}, time.Minute, time.Hour, "development", 1, 1)

	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); err != nil {
		t.Fatalf("first StartEmail: %v", err)
	}
	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); !errors.Is(err, domain.ErrRateLimited) {
		t.Fatalf("expected rate limited, got %v", err)
	}
	if _, err := svc.StartEmail(context.Background(), "other@example.com", "203.0.113.10"); !errors.Is(err, domain.ErrRateLimited) {
		t.Fatalf("expected IP rate limited, got %v", err)
	}
}

func TestNewEmailSenderRejectsDevDriverInProduction(t *testing.T) {
	_, err := NewEmailSender("dev", SMTPEmailConfig{}, "production")
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected production dev-driver rejection, got %v", err)
	}
}

func TestBuildVerificationEmailContainsHeadersAndCode(t *testing.T) {
	message, err := buildVerificationEmail("noreply@example.com", "Sauna", "user@example.com", "123456", 10*time.Minute)
	if err != nil {
		t.Fatalf("buildVerificationEmail: %v", err)
	}
	body := string(message)
	for _, want := range []string{"From:", "Sauna", "noreply@example.com", "To: <user@example.com>", "Subject:", "123456", "10 分钟内有效"} {
		if !strings.Contains(body, want) {
			t.Fatalf("email missing %q in:\n%s", want, body)
		}
	}
}

type fakeEmailSender struct {
	email string
	code  string
	ttl   time.Duration
	err   error
}

func (f *fakeEmailSender) SendVerificationCode(_ context.Context, email string, code string, ttl time.Duration) error {
	f.email = email
	f.code = code
	f.ttl = ttl
	return f.err
}

type fakeAuthRepo struct{}

func (f *fakeAuthRepo) UpsertUserWorkspace(_ context.Context, email string) (domain.AuthIdentity, error) {
	return domain.AuthIdentity{
		User:      domain.User{ID: "user-1", Email: email, DisplayName: email},
		Workspace: domain.Workspace{ID: "workspace-1", OwnerUserID: "user-1", Name: workspaceNameForEmail(email)},
	}, nil
}

func (f *fakeAuthRepo) CreateAuthSession(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func (f *fakeAuthRepo) GetIdentityByTokenHash(_ context.Context, _ string) (domain.AuthIdentity, error) {
	return domain.AuthIdentity{}, domain.ErrNotFound
}

func (f *fakeAuthRepo) RevokeAuthSession(_ context.Context, _ string) error {
	return nil
}
