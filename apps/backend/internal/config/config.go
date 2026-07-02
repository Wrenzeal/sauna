package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv                  string
	HTTPAddr                string
	DatabaseURL             string
	RedisURL                string
	CORSAllowOrigins        []string
	MigrationsDir           string
	NuwaSkillSeedDir        string
	SecretKey               string
	PlatformProviderBaseURL string
	PlatformProviderAPIKey  string
	PlatformChatModel       string
	EmailCodeTTL            time.Duration
	AuthSessionTTL          time.Duration
	TrialLimitPerHour       int
}

func Load() Config {
	appEnv := env("APP_ENV", "development")
	return Config{
		AppEnv:                  appEnv,
		HTTPAddr:                env("HTTP_ADDR", ":19588"),
		DatabaseURL:             env("DATABASE_URL", defaultDatabaseURL(appEnv)),
		RedisURL:                env("REDIS_URL", "redis://127.0.0.1:16379/0"),
		CORSAllowOrigins:        listEnv("CORS_ALLOW_ORIGINS", defaultCORSAllowOrigins()),
		MigrationsDir:           env("MIGRATIONS_DIR", "migrations"),
		NuwaSkillSeedDir:        env("NUWA_SKILL_SEED_DIR", "seed/nuwa-skills"),
		SecretKey:               env("SAUNA_SECRET_KEY", "dev-only-sauna-secret-change-me-32-bytes"),
		PlatformProviderBaseURL: env("PLATFORM_PROVIDER_BASE_URL", ""),
		PlatformProviderAPIKey:  env("PLATFORM_PROVIDER_API_KEY", ""),
		PlatformChatModel:       env("PLATFORM_CHAT_MODEL", ""),
		EmailCodeTTL:            durationEnv("EMAIL_CODE_TTL", 10*time.Minute),
		AuthSessionTTL:          durationEnv("AUTH_SESSION_TTL", 30*24*time.Hour),
		TrialLimitPerHour:       intEnv("TRIAL_LIMIT_PER_HOUR", 20),
	}
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.DatabaseURL) == "" {
		return errors.New("DATABASE_URL is required")
	}
	if strings.TrimSpace(c.RedisURL) == "" {
		return errors.New("REDIS_URL is required")
	}
	if len(c.SecretKey) < 16 {
		return errors.New("SAUNA_SECRET_KEY must be at least 16 characters")
	}
	return nil
}

func defaultDatabaseURL(appEnv string) string {
	if appEnv == "production" {
		return ""
	}
	return "postgres://postgres:postgres@127.0.0.1:5432/sauna?sslmode=disable"
}

func defaultCORSAllowOrigins() []string {
	return []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://sauna.wrenzeal.top",
	}
}

func env(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func listEnv(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}

func intEnv(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
