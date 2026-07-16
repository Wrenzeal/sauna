package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"sauna/backend/internal/domain"
	"sauna/backend/internal/service"
)

func (s *Server) decorateIdentity(identity domain.AuthIdentity) domain.AuthIdentity {
	identity.Permissions.IsAdmin = service.IsAdminEmail(identity.User.Email, s.admins)
	return identity
}
func (s *Server) requireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		identity := identityFromContext(c)
		if !service.IsAdminEmail(identity.User.Email, s.admins) {
			respondError(c, domain.ErrForbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}
func (s *Server) optionalWorkspaceID(c *gin.Context) string {
	if s.auth == nil {
		return ""
	}
	token := bearerToken(c.GetHeader("Authorization"))
	if token == "" {
		return ""
	}
	identity, err := s.auth.IdentityByToken(c.Request.Context(), token)
	if err != nil {
		return ""
	}
	return identity.Workspace.ID
}

func (s *Server) listPublicCatalog(c *gin.Context) {
	if s.catalog == nil {
		respondError(c, domain.ErrNotFound)
		return
	}
	var featured *bool
	if raw := strings.TrimSpace(c.Query("featured")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			respondError(c, domain.ErrInvalidInput)
			return
		}
		featured = &value
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	items, err := s.catalog.List(c.Request.Context(), s.optionalWorkspaceID(c), service.CatalogListRequest{Query: c.Query("query"), Category: c.Query("category"), Featured: featured, Limit: limit})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
func (s *Server) getPublicCatalogEntry(c *gin.Context) {
	item, err := s.catalog.Get(c.Request.Context(), s.optionalWorkspaceID(c), c.Param("slug"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
func (s *Server) installCatalogAgent(c *gin.Context) {
	identity := identityFromContext(c)
	item, err := s.catalog.Install(c.Request.Context(), identity.Workspace.ID, c.Param("agent_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}
func (s *Server) removeCatalogAgent(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.catalog.Remove(c.Request.Context(), identity.Workspace.ID, c.Param("agent_id")); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
func (s *Server) listInstalledCatalog(c *gin.Context) {
	identity := identityFromContext(c)
	items, err := s.catalog.Installed(c.Request.Context(), identity.Workspace.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Server) createCatalogRequest(c *gin.Context) {
	var request service.CreateCatalogRequest
	if c.ShouldBindJSON(&request) != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	identity := identityFromContext(c)
	item, existing, err := s.catalog.CreateRequest(c.Request.Context(), identity.User.ID, request)
	if err != nil {
		respondError(c, err)
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "catalog_agent_exists", "message": "这个人物已经在大厅中。", "agent": existing})
		return
	}
	c.JSON(http.StatusCreated, item)
}
func (s *Server) listMyCatalogRequests(c *gin.Context) {
	identity := identityFromContext(c)
	items, err := s.catalog.MyRequests(c.Request.Context(), identity.User.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
func (s *Server) getMyCatalogRequest(c *gin.Context) {
	identity := identityFromContext(c)
	item, err := s.catalog.MyRequest(c.Request.Context(), identity.User.ID, c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
func (s *Server) followCatalogRequest(c *gin.Context) {
	identity := identityFromContext(c)
	item, err := s.catalog.FollowRequest(c.Request.Context(), identity.User.ID, c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
func (s *Server) listAdminCatalogRequests(c *gin.Context) {
	items, err := s.catalog.AdminRequests(c.Request.Context(), c.Query("status"), c.Query("query"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
func (s *Server) getAdminCatalogRequest(c *gin.Context) {
	item, err := s.catalog.AdminRequest(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
func (s *Server) updateAdminCatalogRequest(c *gin.Context) {
	var request service.UpdateCatalogRequest
	if c.ShouldBindJSON(&request) != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	item, err := s.catalog.UpdateAdminRequest(c.Request.Context(), c.Param("id"), request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
func (s *Server) mergeAdminCatalogRequest(c *gin.Context) {
	var request service.MergeCatalogRequest
	if c.ShouldBindJSON(&request) != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	item, err := s.catalog.MergeAdminRequest(c.Request.Context(), c.Param("id"), request)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (s *Server) listPublicAnnouncements(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	items, err := s.catalog.Announcements(c.Request.Context(), limit)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
func (s *Server) getInbox(c *gin.Context) {
	identity := identityFromContext(c)
	inbox, err := s.catalog.Inbox(c.Request.Context(), identity.User.ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, inbox)
}
func (s *Server) readNotification(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.catalog.ReadNotification(c.Request.Context(), identity.User.ID, c.Param("id")); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
func (s *Server) readAnnouncement(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.catalog.ReadAnnouncement(c.Request.Context(), identity.User.ID, c.Param("id")); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
func (s *Server) readAllInbox(c *gin.Context) {
	identity := identityFromContext(c)
	if err := s.catalog.ReadAll(c.Request.Context(), identity.User.ID); err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

const guestCookieName = "sauna_guest"

func (s *Server) guestIdentity(c *gin.Context) (string, string, error) {
	token, err := c.Cookie(guestCookieName)
	if err != nil || strings.TrimSpace(token) == "" {
		raw := make([]byte, 24)
		if _, err = rand.Read(raw); err != nil {
			return "", "", err
		}
		token = hex.EncodeToString(raw)
		c.SetSameSite(http.SameSiteLaxMode)
		secure := strings.EqualFold(s.appEnv, "production")
		c.SetCookie(guestCookieName, token, 86400, "/api/v1/public", "", secure, true)
	}
	device := sha256.Sum256([]byte(s.secret + ":device:" + token))
	quota := sha256.Sum256([]byte(s.secret + ":quota:" + token + ":" + c.ClientIP()))
	return hex.EncodeToString(device[:]), hex.EncodeToString(quota[:]), nil
}
func (s *Server) startGuestConsultation(c *gin.Context) {
	device, quota, err := s.guestIdentity(c)
	if err != nil {
		respondError(c, err)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if c.ShouldBindJSON(&body) != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	result, err := s.guest.Start(c.Request.Context(), device, quota, c.Param("agent_id"), body.Content)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}
func (s *Server) createGuestTurn(c *gin.Context) {
	device, quota, err := s.guestIdentity(c)
	if err != nil {
		respondError(c, err)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if c.ShouldBindJSON(&body) != nil {
		respondError(c, domain.ErrInvalidInput)
		return
	}
	result, err := s.guest.CreateTurn(c.Request.Context(), device, quota, c.Param("session_id"), body.Content)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}
func (s *Server) listGuestMessages(c *gin.Context) {
	device, _, err := s.guestIdentity(c)
	if err != nil {
		respondError(c, err)
		return
	}
	items, err := s.guest.Messages(c.Request.Context(), device, c.Param("session_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": items})
}
func (s *Server) streamGuestTurn(c *gin.Context) {
	device, _, err := s.guestIdentity(c)
	if err != nil {
		respondError(c, err)
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		respondError(c, errors.New("streaming_not_supported"))
		return
	}
	err = s.guest.StreamTurn(c.Request.Context(), device, c.Param("session_id"), c.Param("turn_id"), c.GetHeader("Last-Event-ID"), func(frame service.StreamFrame) error {
		if _, err := c.Writer.Write([]byte("id: " + frame.Event.EventID + "\n")); err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("event: " + frame.Event.EventType + "\n")); err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("data: " + string(frame.Data) + "\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	})
	if err != nil && !c.Writer.Written() {
		respondError(c, err)
	}
}
