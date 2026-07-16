package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
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

func (s *Store) AcquireCooldown(ctx context.Context, scope string, token string, window time.Duration) (bool, time.Duration, error) {
	if window <= 0 {
		return true, 0, nil
	}
	const acquireCooldown = `
local created = redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2], "NX")
if created then
  return {1, tonumber(ARGV[2])}
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then ttl = 0 end
return {0, ttl}`
	milliseconds := window.Milliseconds()
	result, err := s.client.Eval(ctx, acquireCooldown, []string{cooldownKey(scope)}, codeHash(token), milliseconds).Slice()
	if err != nil {
		return false, 0, err
	}
	if len(result) != 2 {
		return false, 0, fmt.Errorf("unexpected cooldown result length %d", len(result))
	}
	created, err := redisInt64(result[0])
	if err != nil {
		return false, 0, fmt.Errorf("decode cooldown acquired: %w", err)
	}
	ttlMilliseconds, err := redisInt64(result[1])
	if err != nil {
		return false, 0, fmt.Errorf("decode cooldown ttl: %w", err)
	}
	return created == 1, time.Duration(ttlMilliseconds) * time.Millisecond, nil
}

func (s *Store) ReleaseCooldownIfMatches(ctx context.Context, scope string, token string) error {
	const compareAndDelete = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`
	return s.client.Eval(ctx, compareAndDelete, []string{cooldownKey(scope)}, codeHash(token)).Err()
}

func redisInt64(value any) (int64, error) {
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case string:
		return strconv.ParseInt(typed, 10, 64)
	default:
		return 0, fmt.Errorf("unexpected Redis integer type %T", value)
	}
}

func cooldownKey(scope string) string {
	return "cooldown:" + sanitize(scope)
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

func (s *Store) AllowGuestTurn(ctx context.Context, identity string, limit int) (int, error) {
	if limit < 1 {
		return 0, nil
	}
	now := time.Now().UTC()
	key := fmt.Sprintf("guest:turns:%s:%s", now.Format("2006-01-02"), codeHash(identity))
	count, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if count == 1 {
		tomorrow := now.Truncate(24 * time.Hour).Add(25 * time.Hour)
		_ = s.client.ExpireAt(ctx, key, tomorrow).Err()
	}
	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}
	if int(count) > limit {
		return -1, nil
	}
	return remaining, nil
}
