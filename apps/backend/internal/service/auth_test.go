package service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"strings"
	"testing"
	"time"

	"sauna/backend/internal/cache"
	"sauna/backend/internal/domain"
)

func TestStartEmailDevReturnsCodeAndSends(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "development", 5, 20)

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
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 5, 20)

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
	svc := NewAuthService(&fakeAuthRepo{}, store, store, &fakeEmailSender{err: errors.New("smtp down")}, time.Minute, time.Hour, time.Minute, "production", 5, 20)

	_, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if !errors.Is(err, domain.ErrEmailDelivery) {
		t.Fatalf("expected email delivery error, got %v", err)
	}
	ok, verifyErr := store.VerifyEmailCode(context.Background(), "user@example.com", svc.emailSender.(*fakeEmailSender).code)
	if verifyErr != nil {
		t.Fatalf("VerifyEmailCode after delivery failure: %v", verifyErr)
	}
	if ok {
		t.Fatal("verification code must be removed when email delivery fails")
	}
}

func TestStartEmailDeliveryFailureDoesNotDeleteNewerCode(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{err: errors.New("smtp down")}
	sender.onSend = func(email string) {
		if err := store.PutEmailCode(context.Background(), email, "654321", time.Minute); err != nil {
			t.Fatalf("store newer code: %v", err)
		}
	}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 5, 20)

	_, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if !errors.Is(err, domain.ErrEmailDelivery) {
		t.Fatalf("expected email delivery error, got %v", err)
	}
	ok, verifyErr := store.VerifyEmailCode(context.Background(), "user@example.com", "654321")
	if verifyErr != nil || !ok {
		t.Fatalf("newer code must survive older request cleanup, ok=%v err=%v", ok, verifyErr)
	}
}

func TestStartEmailProductionNilSenderDoesNotStoreCode(t *testing.T) {
	store := cache.NewFakeStore()
	svc := NewAuthService(&fakeAuthRepo{}, store, store, nil, time.Minute, time.Hour, time.Minute, "Production", 5, 20)

	_, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if !errors.Is(err, domain.ErrEmailDelivery) {
		t.Fatalf("expected email delivery error, got %v", err)
	}
	ok, verifyErr := store.VerifyEmailCode(context.Background(), "user@example.com", "123456")
	if verifyErr != nil {
		t.Fatalf("VerifyEmailCode after nil sender: %v", verifyErr)
	}
	if ok {
		t.Fatal("production without a sender must not store a verification code")
	}
}

func TestVerifyEmailCodeIsSingleUse(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 5, 20)

	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); err != nil {
		t.Fatalf("StartEmail: %v", err)
	}
	if _, err := svc.VerifyEmail(context.Background(), "user@example.com", sender.code); err != nil {
		t.Fatalf("first VerifyEmail: %v", err)
	}
	if _, err := svc.VerifyEmail(context.Background(), "user@example.com", sender.code); !errors.Is(err, domain.ErrInvalidVerificationCode) {
		t.Fatalf("expected reused code to be unauthorized, got %v", err)
	}
}

func TestStartEmailEnforcesResendCooldown(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 5, 20)

	result, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10")
	if err != nil {
		t.Fatalf("first StartEmail: %v", err)
	}
	if result.ResendAfter != 60 {
		t.Fatalf("expected 60-second resend metadata, got %d", result.ResendAfter)
	}
	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); !errors.Is(err, domain.ErrVerificationCooldown) {
		t.Fatalf("expected resend cooldown, got %v", err)
	}
	if sender.calls != 1 {
		t.Fatalf("expected one delivered email during cooldown, got %d", sender.calls)
	}
}

func TestStartEmailDeliveryFailureReleasesCooldown(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{err: errors.New("smtp down")}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 5, 20)

	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); !errors.Is(err, domain.ErrEmailDelivery) {
		t.Fatalf("expected delivery failure, got %v", err)
	}
	sender.err = nil
	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); err != nil {
		t.Fatalf("expected immediate retry after failed delivery, got %v", err)
	}
}

func TestCooldownAttemptDoesNotConsumeHourlyLimit(t *testing.T) {
	store := cache.NewFakeStore()
	sender := &fakeEmailSender{}
	svc := NewAuthService(&fakeAuthRepo{}, store, store, sender, time.Minute, time.Hour, time.Minute, "production", 2, 20)

	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); err != nil {
		t.Fatalf("first StartEmail: %v", err)
	}
	firstCode := sender.code
	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); !errors.Is(err, domain.ErrVerificationCooldown) {
		t.Fatalf("expected cooldown on second request, got %v", err)
	}
	if err := store.ReleaseCooldownIfMatches(context.Background(), "auth_email:user@example.com", firstCode); err != nil {
		t.Fatalf("release test cooldown: %v", err)
	}
	if _, err := svc.StartEmail(context.Background(), "user@example.com", "203.0.113.10"); err != nil {
		t.Fatalf("cooldown rejection must not consume hourly quota, got %v", err)
	}
}

func TestStartEmailRateLimitsEmailAndIP(t *testing.T) {
	store := cache.NewFakeStore()
	svc := NewAuthService(&fakeAuthRepo{}, store, store, &fakeEmailSender{}, time.Minute, time.Hour, time.Nanosecond, "development", 1, 1)

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

func TestNewEmailSenderTreatsProductionCaseInsensitively(t *testing.T) {
	_, err := NewEmailSender("dev", SMTPEmailConfig{}, " Production ")
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected case-insensitive production rejection, got %v", err)
	}
}

func TestBuildVerificationEmailContainsMultipartBrandContent(t *testing.T) {
	message, err := buildVerificationEmail("sauna@mail.wrenzeal.top", "Sauna", "user@example.com", "123456", 10*time.Minute)
	if err != nil {
		t.Fatalf("buildVerificationEmail: %v", err)
	}
	parsed, err := mail.ReadMessage(bytes.NewReader(message))
	if err != nil {
		t.Fatalf("parse verification email: %v", err)
	}
	if got := parsed.Header.Get("From"); !strings.Contains(got, "Sauna") || !strings.Contains(got, "sauna@mail.wrenzeal.top") {
		t.Fatalf("unexpected From header %q", got)
	}
	subject, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	if err != nil {
		t.Fatalf("decode Subject header: %v", err)
	}
	if !strings.Contains(subject, "Sauna") || !strings.Contains(subject, "123456") {
		t.Fatalf("unexpected Subject header %q", subject)
	}
	mediaType, params, err := mime.ParseMediaType(parsed.Header.Get("Content-Type"))
	if err != nil {
		t.Fatalf("parse Content-Type: %v", err)
	}
	if mediaType != "multipart/alternative" || params["boundary"] == "" {
		t.Fatalf("expected multipart/alternative with boundary, got %q %#v", mediaType, params)
	}

	parts := map[string]string{}
	reader := multipart.NewReader(parsed.Body, params["boundary"])
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("read MIME part: %v", err)
		}
		partType, _, err := mime.ParseMediaType(part.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("parse part Content-Type: %v", err)
		}
		content, err := io.ReadAll(part)
		if err != nil {
			t.Fatalf("read %s part: %v", partType, err)
		}
		parts[partType] = string(content)
	}

	plain := parts["text/plain"]
	html := parts["text/html"]
	for _, want := range []string{"你的私人桑拿房已准备好", "123456", "10 分钟", "https://sauna.wrenzeal.top"} {
		if !strings.Contains(plain, want) {
			t.Fatalf("plain email missing %q in:\n%s", want, plain)
		}
	}
	for _, want := range []string{"<!doctype html>", "使用此验证码登录你的 Sauna 私人智囊工作区", "sauna-mark.png", "你的私人桑拿房", "123456", "10 分钟", "#f4efe6", "#513426"} {
		if !strings.Contains(html, want) {
			t.Fatalf("HTML email missing %q in:\n%s", want, html)
		}
	}
}

func TestVerificationEmailHTMLEscapesCode(t *testing.T) {
	plain, htmlBody := verificationEmailBodies("<123456>", 5)
	if !strings.Contains(plain, "<123456>") {
		t.Fatalf("plain fallback must retain the readable code: %s", plain)
	}
	if strings.Contains(htmlBody, "> <123456> <") || !strings.Contains(htmlBody, "&lt;123456&gt;") {
		t.Fatalf("HTML code must be escaped: %s", htmlBody)
	}
}

type fakeEmailSender struct {
	calls  int
	email  string
	code   string
	ttl    time.Duration
	err    error
	onSend func(email string)
}

func (f *fakeEmailSender) SendVerificationCode(_ context.Context, email string, code string, ttl time.Duration) error {
	f.calls++
	f.email = email
	f.code = code
	f.ttl = ttl
	if f.onSend != nil {
		f.onSend(email)
	}
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
