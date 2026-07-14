package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Store struct {
	client *redis.Client
}

func New(redisURL string) (*Store, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Store{client: redis.NewClient(options)}, nil
}

func (s *Store) Close() error {
	return s.client.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.client.Ping(ctx).Err()
}

func (s *Store) PutEmailCode(ctx context.Context, email string, code string, ttl time.Duration) error {
	return s.client.Set(ctx, emailCodeKey(email), codeHash(code), ttl).Err()
}

func (s *Store) VerifyEmailCode(ctx context.Context, email string, code string) (bool, error) {
	key := emailCodeKey(email)
	value, err := s.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	ok := value == codeHash(code)
	if ok {
		_ = s.client.Del(ctx, key).Err()
	}
	return ok, nil
}

func (s *Store) DeleteEmailCodeIfMatches(ctx context.Context, email string, code string) error {
	const compareAndDelete = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`
	return s.client.Eval(ctx, compareAndDelete, []string{emailCodeKey(email)}, codeHash(code)).Err()
}

func (s *Store) AllowFixedWindow(ctx context.Context, scope string, limit int, window time.Duration) (bool, int, error) {
	if limit <= 0 {
		return false, 0, nil
	}
	bucket := time.Now().UTC().Unix() / int64(window.Seconds())
	key := fmt.Sprintf("rate:%s:%d", sanitize(scope), bucket)
	count, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return false, 0, err
	}
	if count == 1 {
		_ = s.client.Expire(ctx, key, window+time.Minute).Err()
	}
	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}
	return int(count) <= limit, remaining, nil
}

func emailCodeKey(email string) string {
	return "email_code:" + normalizeEmail(email)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func codeHash(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func sanitize(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, " ", "_")
	value = strings.ReplaceAll(value, ":", "_")
	return value
}
