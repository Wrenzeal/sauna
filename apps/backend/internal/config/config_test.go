package config

import (
	"strings"
	"testing"
)

func validSMTPConfig() Config {
	return Config{
		AppEnv:          "production",
		DatabaseURL:     "postgres://example",
		RedisURL:        "redis://example",
		SecretKey:       "0123456789abcdef",
		AuthEmailDriver: "smtp",
		SMTPHost:        "smtp.resend.com",
		SMTPPort:        587,
		SMTPUsername:    "resend",
		SMTPPassword:    "re_test_key",
		SMTPFrom:        "login@mail.wrenzeal.top",
	}
}

func TestValidateProductionSMTPRequiresCredentials(t *testing.T) {
	tests := []struct {
		name string
		edit func(*Config)
		want string
	}{
		{name: "host", edit: func(cfg *Config) { cfg.SMTPHost = "" }, want: "SMTP_HOST"},
		{name: "username", edit: func(cfg *Config) { cfg.SMTPUsername = "" }, want: "SMTP_USERNAME"},
		{name: "password", edit: func(cfg *Config) { cfg.SMTPPassword = "" }, want: "SMTP_PASSWORD"},
		{name: "from", edit: func(cfg *Config) { cfg.SMTPFrom = "" }, want: "SMTP_FROM"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validSMTPConfig()
			tt.edit(&cfg)
			if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected %s validation error, got %v", tt.want, err)
			}
		})
	}
}

func TestValidateTreatsProductionCaseInsensitively(t *testing.T) {
	cfg := validSMTPConfig()
	cfg.AppEnv = " Production "
	cfg.AuthEmailDriver = "dev"
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected case-insensitive production dev-driver rejection, got %v", err)
	}
}

func TestValidateAcceptsCompleteProductionSMTP(t *testing.T) {
	if err := validSMTPConfig().Validate(); err != nil {
		t.Fatalf("expected complete SMTP config to validate, got %v", err)
	}
}
