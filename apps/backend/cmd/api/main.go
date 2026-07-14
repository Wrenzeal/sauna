package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"sauna/backend/internal/cache"
	"sauna/backend/internal/config"
	secretcrypto "sauna/backend/internal/crypto"
	"sauna/backend/internal/httpapi"
	"sauna/backend/internal/llm"
	"sauna/backend/internal/postgres"
	"sauna/backend/internal/service"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("config: %v", err)
	}
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres connect: %v", err)
	}
	defer pool.Close()
	if err := postgres.MigrateDir(ctx, pool, cfg.MigrationsDir); err != nil {
		log.Fatalf("postgres migrate: %v", err)
	}
	if err := postgres.SeedNuwaSkills(ctx, pool, cfg.NuwaSkillSeedDir); err != nil {
		log.Fatalf("nuwa skill seed: %v", err)
	}

	cacheStore, err := cache.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("dragonfly connect: %v", err)
	}
	defer cacheStore.Close()
	if err := cacheStore.Ping(ctx); err != nil {
		log.Fatalf("dragonfly ping: %v", err)
	}

	repo := postgres.NewRepository(pool)
	box := secretcrypto.NewSecretBox(cfg.SecretKey)
	llmClient := llm.NewOpenAICompatibleClient()
	emailSender, err := service.NewEmailSender(cfg.AuthEmailDriver, service.SMTPEmailConfig{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		Username: cfg.SMTPUsername,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
		FromName: cfg.SMTPFromName,
		Security: cfg.SMTPSecurity,
		Timeout:  cfg.SMTPTimeout,
	}, cfg.AppEnv)
	if err != nil {
		log.Fatalf("email sender: %v", err)
	}
	services := httpapi.Services{
		Auth:     service.NewAuthService(repo, cacheStore, cacheStore, emailSender, cfg.EmailCodeTTL, cfg.AuthSessionTTL, cfg.AuthResendCooldown, cfg.AppEnv, cfg.AuthEmailLimitPerHour, cfg.AuthIPLimitPerHour),
		Provider: service.NewProviderService(repo, box, llmClient),
		Agents:   service.NewAgentService(repo),
		Focus:    service.NewFocusRoomService(repo, box, llmClient),
		Distill:  service.NewDistillationService(repo, service.NewLocalNuwaRunner()),
	}

	router := httpapi.NewRouter(services, httpapi.RouterOptions{CORSAllowOrigins: cfg.CORSAllowOrigins})
	server := &http.Server{Addr: cfg.HTTPAddr, Handler: router}
	log.Printf("sauna api listening on %s", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
