package cache

import (
	"context"
	"sync"
	"time"
)

type EmailCodeCache interface {
	PutEmailCode(ctx context.Context, email string, code string, ttl time.Duration) error
	VerifyEmailCode(ctx context.Context, email string, code string) (bool, error)
	DeleteEmailCodeIfMatches(ctx context.Context, email string, code string) error
}

type RateLimiter interface {
	AllowFixedWindow(ctx context.Context, scope string, limit int, window time.Duration) (bool, int, error)
	AcquireCooldown(ctx context.Context, scope string, token string, window time.Duration) (bool, time.Duration, error)
	ReleaseCooldownIfMatches(ctx context.Context, scope string, token string) error
}

type fakeCooldown struct {
	tokenHash string
	expiresAt time.Time
}

type FakeStore struct {
	mu        sync.Mutex
	codes     map[string]string
	rates     map[string]int
	cooldowns map[string]fakeCooldown
}

func NewFakeStore() *FakeStore {
	return &FakeStore{codes: map[string]string{}, rates: map[string]int{}, cooldowns: map[string]fakeCooldown{}}
}

func (f *FakeStore) PutEmailCode(_ context.Context, email string, code string, _ time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.codes[normalizeEmail(email)] = codeHash(code)
	return nil
}

func (f *FakeStore) VerifyEmailCode(_ context.Context, email string, code string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := normalizeEmail(email)
	ok := f.codes[key] == codeHash(code)
	if ok {
		delete(f.codes, key)
	}
	return ok, nil
}

func (f *FakeStore) DeleteEmailCodeIfMatches(_ context.Context, email string, code string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := normalizeEmail(email)
	if f.codes[key] == codeHash(code) {
		delete(f.codes, key)
	}
	return nil
}

func (f *FakeStore) AllowFixedWindow(_ context.Context, scope string, limit int, _ time.Duration) (bool, int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rates[scope]++
	remaining := limit - f.rates[scope]
	if remaining < 0 {
		remaining = 0
	}
	return f.rates[scope] <= limit, remaining, nil
}

func (f *FakeStore) AcquireCooldown(_ context.Context, scope string, token string, window time.Duration) (bool, time.Duration, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	now := time.Now()
	key := sanitize(scope)
	if current, ok := f.cooldowns[key]; ok && current.expiresAt.After(now) {
		return false, current.expiresAt.Sub(now), nil
	}
	f.cooldowns[key] = fakeCooldown{tokenHash: codeHash(token), expiresAt: now.Add(window)}
	return true, window, nil
}

func (f *FakeStore) ReleaseCooldownIfMatches(_ context.Context, scope string, token string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := sanitize(scope)
	if current, ok := f.cooldowns[key]; ok && current.tokenHash == codeHash(token) {
		delete(f.cooldowns, key)
	}
	return nil
}
