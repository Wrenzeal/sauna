package cache

import (
	"context"
	"sync"
	"time"
)

type EmailCodeCache interface {
	PutEmailCode(ctx context.Context, email string, code string, ttl time.Duration) error
	VerifyEmailCode(ctx context.Context, email string, code string) (bool, error)
}

type RateLimiter interface {
	AllowFixedWindow(ctx context.Context, scope string, limit int, window time.Duration) (bool, int, error)
}

type FakeStore struct {
	mu    sync.Mutex
	codes map[string]string
	rates map[string]int
}

func NewFakeStore() *FakeStore {
	return &FakeStore{codes: map[string]string{}, rates: map[string]int{}}
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
