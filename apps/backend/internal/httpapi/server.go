package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"sauna/backend/internal/domain"
	"sauna/backend/internal/service"
)

type Server struct {
	auth     *service.AuthService
	provider *service.ProviderService
	agents   *service.AgentService
	focus    *service.FocusRoomService
	catalog  *service.CatalogService
	guest    *service.GuestService
	admins   []string
	secret   string
	appEnv   string
}

type Services struct {
	Auth     *service.AuthService
	Provider *service.ProviderService
	Agents   *service.AgentService
	Focus    *service.FocusRoomService
	Catalog  *service.CatalogService
	Guest    *service.GuestService
}

type RouterOptions struct {
	CORSAllowOrigins []string
	AdminEmails      []string
	SecretKey        string
	AppEnv           string
}

func NewRouter(services Services, options ...RouterOptions) *gin.Engine {
	routerOptions := RouterOptions{}
	if len(options) > 0 {
		routerOptions = options[0]
	}
	server := &Server{auth: services.Auth, provider: services.Provider, agents: services.Agents, focus: services.Focus, catalog: services.Catalog, guest: services.Guest, admins: routerOptions.AdminEmails, secret: routerOptions.SecretKey, appEnv: routerOptions.AppEnv}
	router := gin.New()
	_ = router.SetTrustedProxies([]string{"127.0.0.1", "::1"})
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware(routerOptions.CORSAllowOrigins))
	router.GET("/health", server.health)

	v1 := router.Group("/api/v1")
	v1.POST("/auth/email/start", server.authStart)
	v1.POST("/auth/email/verify", server.authVerify)
	v1.POST("/auth/logout", server.requireAuth(), server.authLogout)
	v1.GET("/me", server.requireAuth(), server.me)

	v1.GET("/public/agents", server.publicAgents)
	v1.GET("/public/catalog", server.listPublicCatalog)
	v1.GET("/public/catalog/:slug", server.getPublicCatalogEntry)
	v1.GET("/public/announcements", server.listPublicAnnouncements)
	v1.POST("/public/catalog/:agent_id/guest-consultations", server.startGuestConsultation)
	v1.POST("/public/guest-sessions/:session_id/turns", server.createGuestTurn)
	v1.GET("/public/guest-sessions/:session_id/messages", server.listGuestMessages)
	v1.GET("/public/guest-sessions/:session_id/turns/:turn_id/stream", server.streamGuestTurn)

	providers := v1.Group("/provider-configs", server.requireAuth())
	providers.GET("", server.listProviderConfigs)
	providers.POST("", server.createProviderConfig)
	providers.POST("/discover-models", server.discoverProviderModels)
	providers.PATCH("/:id", server.updateProviderConfig)
	providers.DELETE("/:id", server.deleteProviderConfig)
	providers.GET("/:id/models", server.providerModels)
	providers.POST("/:id/test", server.testProviderConfig)
	providers.POST("/:id/test-chat", server.testProviderChat)
	providers.POST("/:id/set-default", server.setDefaultProviderConfig)

	lobby := v1.Group("/lobby", server.requireAuth())
	lobby.GET("/public-agents", server.publicAgents)
	lobby.POST("/public-agents/:agent_id/sessions", server.createSessionFromPublicAgent)

	agents := v1.Group("/agents", server.requireAuth())
	agents.GET("", server.listWorkspaceAgents)

	catalog := v1.Group("/catalog", server.requireAuth())
	catalog.GET("/installed", server.listInstalledCatalog)
	catalog.POST("/:agent_id/install", server.installCatalogAgent)
	catalog.DELETE("/:agent_id/install", server.removeCatalogAgent)

	requests := v1.Group("/catalog-requests", server.requireAuth())
	requests.POST("", server.createCatalogRequest)
	requests.GET("/mine", server.listMyCatalogRequests)
	requests.GET("/:id", server.getMyCatalogRequest)
	requests.POST("/:id/follow", server.followCatalogRequest)

	inbox := v1.Group("/inbox", server.requireAuth())
	inbox.GET("", server.getInbox)
	inbox.POST("/notifications/:id/read", server.readNotification)
	inbox.POST("/announcements/:id/read", server.readAnnouncement)
	inbox.POST("/read-all", server.readAllInbox)

	admin := v1.Group("/admin", server.requireAuth(), server.requireAdmin())
	admin.GET("/catalog-requests", server.listAdminCatalogRequests)
	admin.GET("/catalog-requests/:id", server.getAdminCatalogRequest)
	admin.PATCH("/catalog-requests/:id", server.updateAdminCatalogRequest)
	admin.POST("/catalog-requests/:id/merge", server.mergeAdminCatalogRequest)

	focus := v1.Group("/focus-room", server.requireAuth())
	focus.GET("/sessions", server.listFocusSessions)
	focus.POST("/consultations", server.startConsultation)
	focus.POST("/sessions", server.createFocusSession)
	focus.PATCH("/sessions/:session_id", server.renameFocusSession)
	focus.DELETE("/sessions/:session_id", server.deleteFocusSession)
	focus.POST("/sessions/:session_id/turns", server.createTurn)
	focus.POST("/sessions/:session_id/turns/:turn_id/retry", server.retryTurn)
	focus.GET("/sessions/:session_id/turns/:turn_id/stream", server.streamTurn)
	focus.GET("/sessions/:session_id/messages", server.listMessages)

	v1.GET("/board-meeting", server.boardMeetingStatus)
	board := v1.Group("/board-meeting")
	board.POST("", server.boardMeetingNotImplemented)
	board.POST("/sessions", server.boardMeetingNotImplemented)
	board.POST("/turns", server.boardMeetingNotImplemented)

	return router
}

func corsMiddleware(allowOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowOrigins))
	allowAll := false
	for _, origin := range allowOrigins {
		normalized := strings.TrimRight(strings.TrimSpace(origin), "/")
		if normalized == "" {
			continue
		}
		if normalized == "*" {
			allowAll = true
			continue
		}
		allowed[normalized] = struct{}{}
	}
	return func(c *gin.Context) {
		origin := strings.TrimRight(strings.TrimSpace(c.GetHeader("Origin")), "/")
		if origin == "" {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusNoContent)
				return
			}
			c.Next()
			return
		}
		if allowAll {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if _, ok := allowed[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		} else {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if !allowAll {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Cache-Control, Last-Event-ID")
		c.Header("Access-Control-Expose-Headers", "Content-Type, Cache-Control")
		c.Header("Access-Control-Max-Age", "600")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (s *Server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "sauna-api"})
}

func (s *Server) authStart(c *gin.Context) {
	var request struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	result, err := s.auth.StartEmail(c.Request.Context(), request.Email, c.ClientIP())
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) authVerify(c *gin.Context) {
	var request struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	result, err := s.auth.VerifyEmail(c.Request.Context(), request.Email, request.Code)
	if err != nil {
		respondError(c, err)
		return
	}
	result.Identity = s.decorateIdentity(result.Identity)
	c.JSON(http.StatusOK, result)
}

func (s *Server) authLogout(c *gin.Context) {
	token := bearerToken(c.GetHeader("Authorization"))
	if err := s.auth.Logout(c.Request.Context(), token); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) me(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"identity": s.decorateIdentity(identityFromContext(c))})
}

func (s *Server) publicAgents(c *gin.Context) {
	agents, err := s.agents.ListPublic(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

func (s *Server) listProviderConfigs(c *gin.Context) {
	identity := identityFromContext(c)
	providers, err := s.provider.List(c.Request.Context(), identity.Workspace.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"provider_configs": providers})
}

func (s *Server) createProviderConfig(c *gin.Context) {
	var request service.CreateProviderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	provider, err := s.provider.Create(c.Request.Context(), identity.Workspace.ID, request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, provider)
}

func (s *Server) updateProviderConfig(c *gin.Context) {
	var request service.UpdateProviderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	provider, err := s.provider.Update(c.Request.Context(), identity.Workspace.ID, c.Param("id"), request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, provider)
}

func (s *Server) deleteProviderConfig(c *gin.Context) {
	identity := identityFromContext(c)
	provider, err := s.provider.Delete(c.Request.Context(), identity.Workspace.ID, c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, provider)
}

func (s *Server) providerModels(c *gin.Context) {
	identity := identityFromContext(c)
	models, err := s.provider.Models(c.Request.Context(), identity.Workspace.ID, c.Param("id"))
	if err != nil {
		respondProviderError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"models": models})
}

func (s *Server) discoverProviderModels(c *gin.Context) {
	var request service.DiscoverModelsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	models, err := s.provider.DiscoverModels(c.Request.Context(), request)
	if err != nil {
		respondProviderError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"models": models})
}

func (s *Server) testProviderChat(c *gin.Context) {
	identity := identityFromContext(c)
	result, err := s.provider.TestChat(c.Request.Context(), identity.Workspace.ID, c.Param("id"))
	if err != nil {
		respondProviderError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) testProviderConfig(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.provider.Test(c.Request.Context(), identity.Workspace.ID, c.Param("id")); err != nil {
		respondProviderError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) setDefaultProviderConfig(c *gin.Context) {
	identity := identityFromContext(c)
	provider, err := s.provider.SetDefault(c.Request.Context(), identity.Workspace.ID, c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, provider)
}

func (s *Server) createSessionFromPublicAgent(c *gin.Context) {
	identity := identityFromContext(c)
	request := service.CreateSessionRequest{AgentID: c.Param("agent_id")}
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		var body service.CreateSessionRequest
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, domain.ErrInvalidInput)
			return
		}
		request.Title = body.Title
		request.ProviderConfigID = body.ProviderConfigID
	}
	session, err := s.focus.CreateSession(c.Request.Context(), identity.Workspace.ID, request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (s *Server) clonePublicAgent(c *gin.Context) {
	identity := identityFromContext(c)
	agent, err := s.agents.ClonePublic(c.Request.Context(), identity.Workspace.ID, c.Param("agent_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, agent)
}

func (s *Server) listFocusSessions(c *gin.Context) {
	limit := 0
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed <= 0 {
			respondError(c, domain.ErrInvalidInput)
			return
		}
		limit = parsed
	}
	identity := identityFromContext(c)
	page, err := s.focus.Sessions(c.Request.Context(), identity.Workspace.ID, service.ListFocusSessionsRequest{
		Limit:  limit,
		Cursor: c.Query("cursor"),
	})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

func (s *Server) createFocusSession(c *gin.Context) {
	var request service.CreateSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	session, err := s.focus.CreateSession(c.Request.Context(), identity.Workspace.ID, request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (s *Server) renameFocusSession(c *gin.Context) {
	var request struct {
		Title string `json:"title"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	session, err := s.focus.RenameSession(c.Request.Context(), identity.Workspace.ID, c.Param("session_id"), request.Title)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, session)
}

func (s *Server) deleteFocusSession(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.focus.DeleteSession(c.Request.Context(), identity.Workspace.ID, c.Param("session_id")); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Server) startConsultation(c *gin.Context) {
	var request service.StartConsultationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	result, err := s.focus.StartConsultation(c.Request.Context(), identity.Workspace.ID, request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (s *Server) createTurn(c *gin.Context) {
	var request service.CreateTurnRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	result, err := s.focus.CreateTurn(c.Request.Context(), identity.Workspace.ID, c.Param("session_id"), request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (s *Server) retryTurn(c *gin.Context) {
	identity := identityFromContext(c)
	turn, err := s.focus.RetryTurn(c.Request.Context(), identity.Workspace.ID, c.Param("session_id"), c.Param("turn_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"turn": turn})
}

func (s *Server) streamTurn(c *gin.Context) {
	identity := identityFromContext(c)
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		respondError(c, errors.New("streaming_not_supported"))
		return
	}
	lastEventID := c.GetHeader("Last-Event-ID")
	err := s.focus.StreamTurn(c.Request.Context(), identity.Workspace.ID, c.Param("turn_id"), lastEventID, func(frame service.StreamFrame) error {
		_, err := c.Writer.Write([]byte("id: " + frame.Event.EventID + "\n"))
		if err != nil {
			return err
		}
		_, err = c.Writer.Write([]byte("event: " + frame.Event.EventType + "\n"))
		if err != nil {
			return err
		}
		_, err = c.Writer.Write([]byte("data: " + string(frame.Data) + "\n\n"))
		if err != nil {
			return err
		}
		flusher.Flush()
		return nil
	})
	if err != nil && !c.Writer.Written() {
		respondError(c, err)
	}
}

func (s *Server) listMessages(c *gin.Context) {
	identity := identityFromContext(c)
	messages, err := s.focus.Messages(c.Request.Context(), identity.Workspace.ID, c.Param("session_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (s *Server) boardMeetingStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"enabled": false, "status": "disabled", "message": "董事会桑拿暂未开放"})
}

func (s *Server) boardMeetingNotImplemented(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "board_meeting_not_implemented", "message": "BoardMeeting is not available in MVP."})
}

func (s *Server) notImplemented(code string, message string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": code, "message": message})
	}
}

func (s *Server) requireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		identity, err := s.auth.IdentityByToken(c.Request.Context(), token)
		if err != nil {
			respondError(c, domain.ErrUnauthorized)
			c.Abort()
			return
		}
		c.Set("identity", identity)
		c.Next()
	}
}

func identityFromContext(c *gin.Context) domain.AuthIdentity {
	value, ok := c.Get("identity")
	if !ok {
		return domain.AuthIdentity{}
	}
	identity, _ := value.(domain.AuthIdentity)
	return identity
}

func bearerToken(header string) string {
	parts := strings.Fields(header)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func respondError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	code := "internal_error"
	message := "Internal server error."
	var cooldownError *domain.VerificationCooldownError
	if errors.As(err, &cooldownError) {
		retryAfter := int64((cooldownError.RetryAfter + time.Second - 1) / time.Second)
		if retryAfter < 1 {
			retryAfter = 1
		}
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               "verification_code_cooldown",
			"message":             "验证码已发送，请稍后再试。",
			"retry_after_seconds": retryAfter,
		})
		return
	}
	switch {
	case errors.Is(err, domain.ErrInvalidInput):
		status, code, message = http.StatusBadRequest, "invalid_input", "Invalid request input."
	case errors.Is(err, domain.ErrInvalidVerificationCode):
		status, code, message = http.StatusBadRequest, "invalid_verification_code", "验证码错误或已失效，请检查后重试。"
	case errors.Is(err, domain.ErrUnauthorized):
		status, code, message = http.StatusUnauthorized, "unauthorized", "Authentication required."
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = http.StatusForbidden, "forbidden", "Access denied."
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = http.StatusNotFound, "not_found", "Resource not found."
	case errors.Is(err, domain.ErrProviderConfigRequired):
		status, code, message = http.StatusConflict, "provider_config_required", "请先接入你自己的模型 provider 和 key。"
	case errors.Is(err, domain.ErrGuestProviderUnavailable):
		status, code, message = http.StatusServiceUnavailable, "guest_provider_unavailable", "游客试用模型暂未配置。"
	case errors.Is(err, domain.ErrTurnNotRetryable):
		status, code, message = http.StatusConflict, "turn_not_retryable", "Only failed turns can be retried."
	case errors.Is(err, domain.ErrProviderInUse):
		status, code, message = http.StatusConflict, "provider_config_in_use", "Provider config is referenced by existing sessions."
	case errors.Is(err, domain.ErrRateLimited):
		status, code, message = http.StatusTooManyRequests, "rate_limited", "请求太频繁，请稍后再试。"
	case errors.Is(err, domain.ErrEmailDelivery):
		status, code, message = http.StatusBadGateway, "email_delivery_failed", "验证码邮件发送失败，请检查 SMTP 配置或稍后重试。"
	}
	c.JSON(status, gin.H{"error": code, "message": message})
}

func respondProviderError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidInput),
		errors.Is(err, domain.ErrUnauthorized),
		errors.Is(err, domain.ErrForbidden),
		errors.Is(err, domain.ErrNotFound),
		errors.Is(err, domain.ErrProviderConfigRequired),
		errors.Is(err, domain.ErrRateLimited):
		respondError(c, err)
	default:
		c.JSON(http.StatusBadGateway, gin.H{"error": "provider_request_failed", "message": err.Error()})
	}
}

func (s *Server) listWorkspaceAgents(c *gin.Context) {
	identity := identityFromContext(c)
	agents, err := s.agents.ListWorkspace(c.Request.Context(), identity.Workspace.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents})
}
