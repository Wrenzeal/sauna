package service

import (
	"context"
	"net"
	"net/url"
	"regexp"
	"strings"

	"sauna/backend/internal/domain"
)

type CatalogListRequest struct {
	Query    string
	Category string
	Featured *bool
	Limit    int
}

type CreateCatalogRequest struct {
	TargetName string   `json:"target_name"`
	Reason     string   `json:"reason"`
	SourceURLs []string `json:"source_urls"`
}

type UpdateCatalogRequest struct {
	Status    string `json:"status"`
	AdminNote string `json:"admin_note"`
}

type MergeCatalogRequest struct {
	TargetRequestID string `json:"target_request_id"`
}

type CatalogRepository interface {
	ListCatalog(ctx context.Context, workspaceID string, request CatalogListRequest) ([]domain.CatalogEntry, error)
	GetCatalogBySlug(ctx context.Context, workspaceID, slug string) (domain.CatalogEntry, error)
	GetCatalogByAgentID(ctx context.Context, agentID string) (domain.CatalogEntry, error)
	InstallCatalogAgent(ctx context.Context, workspaceID, agentID string) error
	RemoveCatalogAgent(ctx context.Context, workspaceID, agentID string) error
	ListInstalledCatalog(ctx context.Context, workspaceID string) ([]domain.CatalogEntry, error)
	CreateOrFollowCatalogRequest(ctx context.Context, userID string, request CreateCatalogRequest, adminEmails []string) (domain.CatalogRequest, *domain.CatalogEntry, error)
	FollowCatalogRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error)
	ListUserCatalogRequests(ctx context.Context, userID string) ([]domain.CatalogRequest, error)
	GetUserCatalogRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error)
	ListAdminCatalogRequests(ctx context.Context, status, query string) ([]domain.CatalogRequest, error)
	GetAdminCatalogRequest(ctx context.Context, requestID string) (domain.CatalogRequest, error)
	UpdateAdminCatalogRequest(ctx context.Context, requestID string, request UpdateCatalogRequest) (domain.CatalogRequest, error)
	MergeAdminCatalogRequest(ctx context.Context, requestID, targetID string) (domain.CatalogRequest, error)
	ListPublicAnnouncements(ctx context.Context, limit int) ([]domain.Announcement, error)
	GetInbox(ctx context.Context, userID string) (domain.Inbox, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID string) error
	MarkAnnouncementRead(ctx context.Context, userID, announcementID string) error
	MarkInboxRead(ctx context.Context, userID string) error
}

type CatalogService struct {
	repo        CatalogRepository
	adminEmails []string
}

func NewCatalogService(repo CatalogRepository, adminEmails []string) *CatalogService {
	return &CatalogService{repo: repo, adminEmails: normalizeEmails(adminEmails)}
}

func (s *CatalogService) List(ctx context.Context, workspaceID string, request CatalogListRequest) ([]domain.CatalogEntry, error) {
	request.Query = strings.TrimSpace(request.Query)
	request.Category = strings.TrimSpace(request.Category)
	if request.Limit == 0 {
		request.Limit = 50
	}
	if request.Limit < 1 || request.Limit > 100 {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.ListCatalog(ctx, workspaceID, request)
}

func (s *CatalogService) Get(ctx context.Context, workspaceID, slug string) (domain.CatalogEntry, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return domain.CatalogEntry{}, domain.ErrInvalidInput
	}
	return s.repo.GetCatalogBySlug(ctx, workspaceID, slug)
}

func (s *CatalogService) Install(ctx context.Context, workspaceID, agentID string) (domain.CatalogEntry, error) {
	if strings.TrimSpace(agentID) == "" {
		return domain.CatalogEntry{}, domain.ErrInvalidInput
	}
	if err := s.repo.InstallCatalogAgent(ctx, workspaceID, agentID); err != nil {
		return domain.CatalogEntry{}, err
	}
	entry, err := s.repo.GetCatalogByAgentID(ctx, agentID)
	entry.Installed = err == nil
	return entry, err
}

func (s *CatalogService) Remove(ctx context.Context, workspaceID, agentID string) error {
	if strings.TrimSpace(agentID) == "" {
		return domain.ErrInvalidInput
	}
	return s.repo.RemoveCatalogAgent(ctx, workspaceID, agentID)
}

func (s *CatalogService) Installed(ctx context.Context, workspaceID string) ([]domain.CatalogEntry, error) {
	return s.repo.ListInstalledCatalog(ctx, workspaceID)
}

func (s *CatalogService) CreateRequest(ctx context.Context, userID string, request CreateCatalogRequest) (domain.CatalogRequest, *domain.CatalogEntry, error) {
	request.TargetName = strings.TrimSpace(request.TargetName)
	request.Reason = strings.TrimSpace(request.Reason)
	if request.TargetName == "" || len([]rune(request.TargetName)) > 80 || len([]rune(request.Reason)) > 2000 {
		return domain.CatalogRequest{}, nil, domain.ErrInvalidInput
	}
	urls, err := validatePublicURLs(request.SourceURLs, 10)
	if err != nil {
		return domain.CatalogRequest{}, nil, err
	}
	request.SourceURLs = urls
	return s.repo.CreateOrFollowCatalogRequest(ctx, userID, request, s.adminEmails)
}

func (s *CatalogService) FollowRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error) {
	if strings.TrimSpace(requestID) == "" {
		return domain.CatalogRequest{}, domain.ErrInvalidInput
	}
	return s.repo.FollowCatalogRequest(ctx, userID, requestID)
}

func (s *CatalogService) MyRequests(ctx context.Context, userID string) ([]domain.CatalogRequest, error) {
	return s.repo.ListUserCatalogRequests(ctx, userID)
}

func (s *CatalogService) MyRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error) {
	return s.repo.GetUserCatalogRequest(ctx, userID, requestID)
}

func (s *CatalogService) AdminRequests(ctx context.Context, status, query string) ([]domain.CatalogRequest, error) {
	return s.repo.ListAdminCatalogRequests(ctx, strings.TrimSpace(status), strings.TrimSpace(query))
}

func (s *CatalogService) AdminRequest(ctx context.Context, requestID string) (domain.CatalogRequest, error) {
	return s.repo.GetAdminCatalogRequest(ctx, requestID)
}

func (s *CatalogService) UpdateAdminRequest(ctx context.Context, requestID string, request UpdateCatalogRequest) (domain.CatalogRequest, error) {
	allowed := map[string]bool{"submitted": true, "reviewing": true, "approved": true, "distilling": true, "fulfilled": true, "rejected": true}
	request.Status = strings.TrimSpace(request.Status)
	request.AdminNote = strings.TrimSpace(request.AdminNote)
	if !allowed[request.Status] || len([]rune(request.AdminNote)) > 2000 {
		return domain.CatalogRequest{}, domain.ErrInvalidInput
	}
	return s.repo.UpdateAdminCatalogRequest(ctx, requestID, request)
}

func (s *CatalogService) MergeAdminRequest(ctx context.Context, requestID string, request MergeCatalogRequest) (domain.CatalogRequest, error) {
	if strings.TrimSpace(requestID) == "" || strings.TrimSpace(request.TargetRequestID) == "" || requestID == request.TargetRequestID {
		return domain.CatalogRequest{}, domain.ErrInvalidInput
	}
	return s.repo.MergeAdminCatalogRequest(ctx, requestID, request.TargetRequestID)
}

func (s *CatalogService) Announcements(ctx context.Context, limit int) ([]domain.Announcement, error) {
	if limit == 0 {
		limit = 20
	}
	if limit < 1 || limit > 50 {
		return nil, domain.ErrInvalidInput
	}
	return s.repo.ListPublicAnnouncements(ctx, limit)
}

func (s *CatalogService) Inbox(ctx context.Context, userID string) (domain.Inbox, error) {
	return s.repo.GetInbox(ctx, userID)
}
func (s *CatalogService) ReadNotification(ctx context.Context, userID, id string) error {
	return s.repo.MarkNotificationRead(ctx, userID, id)
}
func (s *CatalogService) ReadAnnouncement(ctx context.Context, userID, id string) error {
	return s.repo.MarkAnnouncementRead(ctx, userID, id)
}
func (s *CatalogService) ReadAll(ctx context.Context, userID string) error {
	return s.repo.MarkInboxRead(ctx, userID)
}

var requestNameCleaner = regexp.MustCompile(`[^a-z0-9\p{Han}]+`)

func NormalizeCatalogName(value string) string {
	return requestNameCleaner.ReplaceAllString(strings.ToLower(strings.TrimSpace(value)), "")
}

func normalizeEmails(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func IsAdminEmail(email string, values []string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	for _, value := range values {
		if email == strings.ToLower(strings.TrimSpace(value)) {
			return true
		}
	}
	return false
}

func validatePublicURLs(values []string, limit int) ([]string, error) {
	if len(values) > limit {
		return nil, domain.ErrInvalidInput
	}
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		parsed, err := url.Parse(value)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
			return nil, domain.ErrInvalidInput
		}
		host := strings.ToLower(parsed.Hostname())
		if host == "localhost" || strings.HasSuffix(host, ".localhost") {
			return nil, domain.ErrInvalidInput
		}
		if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified()) {
			return nil, domain.ErrInvalidInput
		}
		parsed.Fragment = ""
		value = parsed.String()
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out, nil
}
