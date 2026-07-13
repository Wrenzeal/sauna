package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv                string
	HTTPAddr              string
	DatabaseURL           string
	RedisURL              string
	CORSAllowOrigins      []string
	MigrationsDir         string
	NuwaSkillSeedDir      string
	SecretKey             string
	EmailCodeTTL          time.Duration
	AuthSessionTTL        time.Duration
	AuthEmailDriver       string
	AuthEmailLimitPerHour int
	AuthIPLimitPerHour    int
	SMTPHost              string
	SMTPPort              int
	SMTPUsername          string
	SMTPPassword          string
	SMTPFrom              string
	SMTPFromName          string
	SMTPSecurity          string
	SMTPTimeout           time.Duration
}

func Load() Config {
	appEnv := env("APP_ENV", "development")
	return Config{
		AppEnv:                appEnv,
		HTTPAddr:              env("HTTP_ADDR", ":19588"),
		DatabaseURL:           env("DATABASE_URL", defaultDatabaseURL(appEnv)),
		RedisURL:              env("REDIS_URL", "redis://127.0.0.1:16379/0"),
		CORSAllowOrigins:      listEnv("CORS_ALLOW_ORIGINS", defaultCORSAllowOrigins()),
		MigrationsDir:         env("MIGRATIONS_DIR", "migrations"),
		NuwaSkillSeedDir:      env("NUWA_SKILL_SEED_DIR", "seed/nuwa-skills"),
		SecretKey:             env("SAUNA_SECRET_KEY", "dev-only-sauna-secret-change-me-32-bytes"),
		EmailCodeTTL:          durationEnv("EMAIL_CODE_TTL", 10*time.Minute),
		AuthSessionTTL:        durationEnv("AUTH_SESSION_TTL", 30*24*time.Hour),
		AuthEmailDriver:       env("AUTH_EMAIL_DRIVER", defaultAuthEmailDriver(appEnv)),
		AuthEmailLimitPerHour: intEnv("AUTH_EMAIL_LIMIT_PER_HOUR", 5),
		AuthIPLimitPerHour:    intEnv("AUTH_IP_LIMIT_PER_HOUR", 20),
		SMTPHost:              env("SMTP_HOST", ""),
		SMTPPort:              intEnv("SMTP_PORT", 587),
		SMTPUsername:          env("SMTP_USERNAME", ""),
		SMTPPassword:          env("SMTP_PASSWORD", ""),
		SMTPFrom:              env("SMTP_FROM", ""),
		SMTPFromName:          env("SMTP_FROM_NAME", "Sauna"),
		SMTPSecurity:          env("SMTP_SECURITY", "auto"),
		SMTPTimeout:           durationEnv("SMTP_TIMEOUT", 15*time.Second),
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
	driver := strings.ToLower(strings.TrimSpace(c.AuthEmailDriver))
	switch driver {
	case "dev", "log":
		if c.AppEnv == "production" {
			return errors.New("AUTH_EMAIL_DRIVER=dev is not allowed in production")
		}
	case "smtp":
		if strings.TrimSpace(c.SMTPHost) == "" {
			return errors.New("SMTP_HOST is required when AUTH_EMAIL_DRIVER=smtp")
		}
		if strings.TrimSpace(c.SMTPFrom) == "" {
			return errors.New("SMTP_FROM is required when AUTH_EMAIL_DRIVER=smtp")
		}
		if c.SMTPPort <= 0 {
			return errors.New("SMTP_PORT must be positive")
		}
	default:
		return errors.New("AUTH_EMAIL_DRIVER must be dev or smtp")
	}
	return nil
}

func defaultAuthEmailDriver(appEnv string) string {
	if appEnv == "production" {
		return "smtp"
	}
	return "dev"
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
