package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"sauna/backend/internal/cache"
	"sauna/backend/internal/domain"
)

type AuthService struct {
	repo                  AuthRepository
	codes                 cache.EmailCodeCache
	rate                  cache.RateLimiter
	emailSender           EmailSender
	codeTTL               time.Duration
	sessionTTL            time.Duration
	appEnv                string
	authEmailLimitPerHour int
	authIPLimitPerHour    int
}

type AuthStartResult struct {
	Email     string `json:"email"`
	DevCode   string `json:"dev_code,omitempty"`
	ExpiresIn int64  `json:"expires_in_seconds"`
}

type AuthVerifyResult struct {
	Token     string              `json:"token"`
	Identity  domain.AuthIdentity `json:"identity"`
	ExpiresAt time.Time           `json:"expires_at"`
}

func NewAuthService(repo AuthRepository, codes cache.EmailCodeCache, rate cache.RateLimiter, emailSender EmailSender, codeTTL time.Duration, sessionTTL time.Duration, appEnv string, authEmailLimitPerHour int, authIPLimitPerHour int) *AuthService {
	appEnv = strings.ToLower(strings.TrimSpace(appEnv))
	return &AuthService{
		repo:                  repo,
		codes:                 codes,
		rate:                  rate,
		emailSender:           emailSender,
		codeTTL:               codeTTL,
		sessionTTL:            sessionTTL,
		appEnv:                appEnv,
		authEmailLimitPerHour: authEmailLimitPerHour,
		authIPLimitPerHour:    authIPLimitPerHour,
	}
}

func (s *AuthService) StartEmail(ctx context.Context, email string, clientIP string) (AuthStartResult, error) {
	email = normalizeEmail(email)
	if email == "" || !strings.Contains(email, "@") {
		return AuthStartResult{}, domain.ErrInvalidInput
	}
	if err := s.allowAuthStart(ctx, email, clientIP); err != nil {
		return AuthStartResult{}, err
	}
	sender := s.emailSender
	if sender == nil {
		if s.appEnv == "production" {
			return AuthStartResult{}, fmt.Errorf("%w: email sender is not configured", domain.ErrEmailDelivery)
		}
		sender = DevEmailSender{}
	}
	code, err := randomDigits(6)
	if err != nil {
		return AuthStartResult{}, err
	}
	if err := s.codes.PutEmailCode(ctx, email, code, s.codeTTL); err != nil {
		return AuthStartResult{}, err
	}
	if err := sender.SendVerificationCode(ctx, email, code, s.codeTTL); err != nil {
		cleanupErr := s.codes.DeleteEmailCodeIfMatches(ctx, email, code)
		if cleanupErr != nil {
			return AuthStartResult{}, fmt.Errorf("%w: %v; verification code cleanup failed: %v", domain.ErrEmailDelivery, err, cleanupErr)
		}
		return AuthStartResult{}, fmt.Errorf("%w: %v", domain.ErrEmailDelivery, err)
	}
	result := AuthStartResult{Email: email, ExpiresIn: int64(s.codeTTL.Seconds())}
	if s.appEnv != "production" {
		result.DevCode = code
	}
	return result, nil
}

func (s *AuthService) VerifyEmail(ctx context.Context, email string, code string) (AuthVerifyResult, error) {
	email = normalizeEmail(email)
	ok, err := s.codes.VerifyEmailCode(ctx, email, code)
	if err != nil {
		return AuthVerifyResult{}, err
	}
	if !ok {
		return AuthVerifyResult{}, domain.ErrUnauthorized
	}
	identity, err := s.repo.UpsertUserWorkspace(ctx, email)
	if err != nil {
		return AuthVerifyResult{}, err
	}
	token, err := randomToken()
	if err != nil {
		return AuthVerifyResult{}, err
	}
	expiresAt := time.Now().UTC().Add(s.sessionTTL)
	if err := s.repo.CreateAuthSession(ctx, identity.User.ID, HashToken(token), expiresAt); err != nil {
		return AuthVerifyResult{}, err
	}
	return AuthVerifyResult{Token: token, Identity: identity, ExpiresAt: expiresAt}, nil
}

func (s *AuthService) IdentityByToken(ctx context.Context, token string) (domain.AuthIdentity, error) {
	if strings.TrimSpace(token) == "" {
		return domain.AuthIdentity{}, domain.ErrUnauthorized
	}
	return s.repo.GetIdentityByTokenHash(ctx, HashToken(token))
}

func (s *AuthService) Logout(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}
	return s.repo.RevokeAuthSession(ctx, HashToken(token))
}

func (s *AuthService) allowAuthStart(ctx context.Context, email string, clientIP string) error {
	if s.rate == nil {
		return nil
	}
	if s.authEmailLimitPerHour > 0 {
		allowed, _, err := s.rate.AllowFixedWindow(ctx, "auth_email:"+email, s.authEmailLimitPerHour, time.Hour)
		if err != nil {
			return err
		}
		if !allowed {
			return domain.ErrRateLimited
		}
	}
	clientIP = strings.TrimSpace(clientIP)
	if clientIP != "" && s.authIPLimitPerHour > 0 {
		allowed, _, err := s.rate.AllowFixedWindow(ctx, "auth_ip:"+clientIP, s.authIPLimitPerHour, time.Hour)
		if err != nil {
			return err
		}
		if !allowed {
			return domain.ErrRateLimited
		}
	}
	return nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func randomDigits(n int) (string, error) {
	out := make([]byte, n)
	for i := range out {
		v, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		out[i] = byte('0' + v.Int64())
	}
	return string(out), nil
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func workspaceNameForEmail(email string) string {
	local := strings.Split(email, "@")[0]
	if local == "" {
		return "我的桑拿房"
	}
	return fmt.Sprintf("%s 的桑拿房", local)
}
