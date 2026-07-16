package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"sauna/backend/internal/domain"
	"sauna/backend/internal/service"
)

const catalogColumns = `
	ce.id::text,
	a.id::text, a.workspace_id::text, a.display_name, a.slug, a.avatar_emoji, a.role_summary, a.status, a.is_public_template, a.current_version_id::text, a.created_at, a.updated_at,
	ce.summary, ce.categories, ce.tags, ce.featured, ce.sort_order, ce.content_hash, ce.source_description, ce.source_urls, ce.manifest, ce.status, ce.published_at`

func (r *Repository) ListCatalog(ctx context.Context, workspaceID string, request service.CatalogListRequest) ([]domain.CatalogEntry, error) {
	query := `%` + strings.ToLower(request.Query) + `%`
	rows, err := r.pool.Query(ctx, `
		SELECT `+catalogColumns+`,
		       EXISTS(SELECT 1 FROM workspace_agent_subscriptions was WHERE was.workspace_id=NULLIF($1,'')::uuid AND was.agent_id=a.id),
		       (SELECT count(*)::int FROM workspace_agent_subscriptions was2 WHERE was2.agent_id=a.id)
		FROM catalog_entries ce JOIN agents a ON a.id=ce.agent_id
		WHERE ce.status='published' AND a.is_public_template=true AND a.deleted_at IS NULL
		  AND ($2='' OR lower(a.display_name) LIKE $2 OR lower(ce.summary) LIKE $2 OR EXISTS(SELECT 1 FROM unnest(ce.tags) tag WHERE lower(tag) LIKE $2))
		  AND ($3='' OR $3=ANY(ce.categories))
		  AND ($4::boolean IS NULL OR ce.featured=$4)
		ORDER BY ce.featured DESC, ce.sort_order ASC, ce.published_at DESC
		LIMIT $5`, workspaceID, query, request.Category, request.Featured, request.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.CatalogEntry, 0)
	for rows.Next() {
		entry, err := scanCatalogEntry(rows, true)
		if err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

func (r *Repository) GetCatalogBySlug(ctx context.Context, workspaceID, slug string) (domain.CatalogEntry, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+catalogColumns+`, EXISTS(SELECT 1 FROM workspace_agent_subscriptions was WHERE was.workspace_id=NULLIF($1,'')::uuid AND was.agent_id=a.id), (SELECT count(*)::int FROM workspace_agent_subscriptions was2 WHERE was2.agent_id=a.id) FROM catalog_entries ce JOIN agents a ON a.id=ce.agent_id WHERE ce.status='published' AND a.slug=$2 AND a.is_public_template=true AND a.deleted_at IS NULL`, workspaceID, slug)
	entry, err := scanCatalogEntry(row, true)
	if err != nil {
		return domain.CatalogEntry{}, mapErr(err)
	}
	return entry, nil
}

func (r *Repository) GetCatalogByAgentID(ctx context.Context, agentID string) (domain.CatalogEntry, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+catalogColumns+`, false, (SELECT count(*)::int FROM workspace_agent_subscriptions was2 WHERE was2.agent_id=a.id) FROM catalog_entries ce JOIN agents a ON a.id=ce.agent_id WHERE ce.status='published' AND a.id=$1::uuid AND a.is_public_template=true AND a.deleted_at IS NULL`, agentID)
	entry, err := scanCatalogEntry(row, true)
	if err != nil {
		return domain.CatalogEntry{}, mapErr(err)
	}
	return entry, nil
}

func (r *Repository) InstallCatalogAgent(ctx context.Context, workspaceID, agentID string) error {
	command, err := r.pool.Exec(ctx, `INSERT INTO workspace_agent_subscriptions(workspace_id,agent_id) SELECT $1::uuid,a.id FROM agents a JOIN catalog_entries ce ON ce.agent_id=a.id WHERE a.id=$2::uuid AND a.is_public_template=true AND a.deleted_at IS NULL AND ce.status='published' ON CONFLICT DO NOTHING`, workspaceID, agentID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		var exists bool
		if err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workspace_agent_subscriptions WHERE workspace_id=$1::uuid AND agent_id=$2::uuid)`, workspaceID, agentID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return domain.ErrNotFound
		}
	}
	return nil
}

func (r *Repository) RemoveCatalogAgent(ctx context.Context, workspaceID, agentID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM workspace_agent_subscriptions WHERE workspace_id=$1::uuid AND agent_id=$2::uuid`, workspaceID, agentID)
	return err
}

func (r *Repository) ListInstalledCatalog(ctx context.Context, workspaceID string) ([]domain.CatalogEntry, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+catalogColumns+`, true, (SELECT count(*)::int FROM workspace_agent_subscriptions was2 WHERE was2.agent_id=a.id) FROM workspace_agent_subscriptions was JOIN catalog_entries ce ON ce.agent_id=was.agent_id JOIN agents a ON a.id=ce.agent_id WHERE was.workspace_id=$1::uuid AND ce.status='published' AND a.deleted_at IS NULL ORDER BY was.created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.CatalogEntry, 0)
	for rows.Next() {
		entry, err := scanCatalogEntry(rows, true)
		if err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

func scanCatalogEntry(row interface{ Scan(...any) error }, includeExtras bool) (domain.CatalogEntry, error) {
	var entry domain.CatalogEntry
	args := []any{&entry.ID, &entry.Agent.ID, &nullableStringScanner{dest: &entry.Agent.WorkspaceID}, &entry.Agent.DisplayName, &entry.Agent.Slug, &entry.Agent.AvatarEmoji, &entry.Agent.RoleSummary, &entry.Agent.Status, &entry.Agent.IsPublicTemplate, &entry.Agent.CurrentVersionID, &entry.Agent.CreatedAt, &entry.Agent.UpdatedAt, &entry.Summary, &entry.Categories, &entry.Tags, &entry.Featured, &entry.SortOrder, &entry.ContentHash, &entry.SourceDescription, &jsonStringSliceScanner{dest: &entry.SourceURLs}, &jsonBytesScanner{dest: &entry.Manifest}, &entry.Status, &entry.PublishedAt}
	if includeExtras {
		args = append(args, &entry.Installed, &entry.FollowerCount)
	}
	return entry, row.Scan(args...)
}

const requestColumns = `cr.id::text, cr.requester_user_id::text, u.email, cr.target_name, cr.normalized_name, cr.reason, cr.source_urls, cr.status, cr.admin_note, cr.linked_agent_id::text, cr.merged_into_id::text, (SELECT count(*)::int FROM catalog_request_followers f WHERE f.request_id=cr.id), EXISTS(SELECT 1 FROM catalog_request_followers f2 WHERE f2.request_id=cr.id AND f2.user_id=NULLIF($1::text,'')::uuid), cr.created_at, cr.updated_at, cr.completed_at`

func (r *Repository) CreateOrFollowCatalogRequest(ctx context.Context, userID string, request service.CreateCatalogRequest, adminEmails []string) (domain.CatalogRequest, *domain.CatalogEntry, error) {
	normalized := service.NormalizeCatalogName(request.TargetName)
	var entry domain.CatalogEntry
	row := r.pool.QueryRow(ctx, `SELECT `+catalogColumns+`, false, (SELECT count(*)::int FROM workspace_agent_subscriptions was WHERE was.agent_id=a.id) FROM catalog_entries ce JOIN agents a ON a.id=ce.agent_id WHERE ce.status='published' AND (lower(a.display_name)=lower($1) OR replace(lower(a.slug),'-','')=$2) LIMIT 1`, request.TargetName, normalized)
	if found, err := scanCatalogEntry(row, true); err == nil {
		entry = found
		return domain.CatalogRequest{}, &entry, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return domain.CatalogRequest{}, nil, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CatalogRequest{}, nil, err
	}
	defer tx.Rollback(ctx)
	var requestID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM catalog_requests WHERE normalized_name=$1 AND status IN ('submitted','reviewing','approved','distilling') AND merged_into_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE`, normalized).Scan(&requestID)
	created := false
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return domain.CatalogRequest{}, nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		urls, _ := json.Marshal(request.SourceURLs)
		if err = tx.QueryRow(ctx, `INSERT INTO catalog_requests(requester_user_id,target_name,normalized_name,reason,source_urls) VALUES($1::uuid,$2,$3,$4,$5::jsonb) RETURNING id::text`, userID, request.TargetName, normalized, request.Reason, urls).Scan(&requestID); err != nil {
			return domain.CatalogRequest{}, nil, err
		}
		created = true
	}
	if _, err = tx.Exec(ctx, `INSERT INTO catalog_request_followers(request_id,user_id) VALUES($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`, requestID, userID); err != nil {
		return domain.CatalogRequest{}, nil, err
	}
	if created {
		for _, email := range adminEmails {
			_, err = tx.Exec(ctx, `INSERT INTO notification_outbox(recipient,subject,text_body,html_body) VALUES($1,$2,$3,$4)`, email, "Sauna 新人物申请："+request.TargetName, "有用户申请上架人物："+request.TargetName, "<p>有用户申请上架人物：<strong>"+escapeHTML(request.TargetName)+"</strong></p>")
			if err != nil {
				return domain.CatalogRequest{}, nil, err
			}
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.CatalogRequest{}, nil, err
	}
	result, err := r.GetUserCatalogRequest(ctx, userID, requestID)
	return result, nil, err
}

func (r *Repository) FollowCatalogRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error) {
	command, err := r.pool.Exec(ctx, `INSERT INTO catalog_request_followers(request_id,user_id) SELECT id,$2::uuid FROM catalog_requests WHERE id=$1::uuid AND status IN ('submitted','reviewing','approved','distilling') AND merged_into_id IS NULL ON CONFLICT DO NOTHING`, requestID, userID)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	if command.RowsAffected() == 0 {
		var ok bool
		_ = r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM catalog_request_followers WHERE request_id=$1::uuid AND user_id=$2::uuid)`, requestID, userID).Scan(&ok)
		if !ok {
			return domain.CatalogRequest{}, domain.ErrInvalidInput
		}
	}
	return r.GetUserCatalogRequest(ctx, userID, requestID)
}

func (r *Repository) ListUserCatalogRequests(ctx context.Context, userID string) ([]domain.CatalogRequest, error) {
	return r.listRequests(ctx, userID, `JOIN catalog_request_followers own ON own.request_id=cr.id AND own.user_id=$1::uuid`, ``, ``)
}
func (r *Repository) GetUserCatalogRequest(ctx context.Context, userID, requestID string) (domain.CatalogRequest, error) {
	items, err := r.listRequests(ctx, userID, `JOIN catalog_request_followers own ON own.request_id=cr.id AND own.user_id=$1::uuid`, `AND cr.id=$2::uuid`, requestID)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	if len(items) == 0 {
		return domain.CatalogRequest{}, domain.ErrNotFound
	}
	return items[0], nil
}
func (r *Repository) ListAdminCatalogRequests(ctx context.Context, status, query string) ([]domain.CatalogRequest, error) {
	return r.listAdminRequests(ctx, status, query, "")
}
func (r *Repository) GetAdminCatalogRequest(ctx context.Context, requestID string) (domain.CatalogRequest, error) {
	items, err := r.listAdminRequests(ctx, "", "", requestID)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	if len(items) == 0 {
		return domain.CatalogRequest{}, domain.ErrNotFound
	}
	return items[0], nil
}

func (r *Repository) listRequests(ctx context.Context, userID, join, where, requestID string) ([]domain.CatalogRequest, error) {
	args := []any{userID}
	if requestID != "" {
		args = append(args, requestID)
	}
	rows, err := r.pool.Query(ctx, `SELECT `+requestColumns+` FROM catalog_requests cr JOIN users u ON u.id=cr.requester_user_id `+join+` WHERE 1=1 `+where+` ORDER BY cr.created_at DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectRequests(rows)
}
func (r *Repository) listAdminRequests(ctx context.Context, status, query, requestID string) ([]domain.CatalogRequest, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+requestColumns+` FROM catalog_requests cr JOIN users u ON u.id=cr.requester_user_id WHERE ($2='' OR cr.status=$2) AND ($3='' OR lower(cr.target_name) LIKE '%'||lower($3)||'%' OR lower(u.email) LIKE '%'||lower($3)||'%') AND ($4='' OR cr.id=NULLIF($4,'')::uuid) ORDER BY (SELECT count(*) FROM catalog_request_followers f WHERE f.request_id=cr.id) DESC, cr.created_at DESC`, "", status, query, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectRequests(rows)
}
func collectRequests(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]domain.CatalogRequest, error) {
	out := make([]domain.CatalogRequest, 0)
	for rows.Next() {
		var item domain.CatalogRequest
		if err := rows.Scan(&item.ID, &item.RequesterUserID, &item.RequesterEmail, &item.TargetName, &item.NormalizedName, &item.Reason, &jsonStringSliceScanner{dest: &item.SourceURLs}, &item.Status, &item.AdminNote, &nullableStringScanner{dest: &item.LinkedAgentID}, &nullableStringScanner{dest: &item.MergedIntoID}, &item.FollowerCount, &item.Following, &item.CreatedAt, &item.UpdatedAt, &nullableTimeScanner{dest: &item.CompletedAt}); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateAdminCatalogRequest(ctx context.Context, requestID string, request service.UpdateCatalogRequest) (domain.CatalogRequest, error) {
	command, err := r.pool.Exec(ctx, `UPDATE catalog_requests SET status=$2,admin_note=$3,updated_at=now(),completed_at=CASE WHEN $2 IN ('fulfilled','rejected') THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$1::uuid AND merged_into_id IS NULL`, requestID, request.Status, request.AdminNote)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	if command.RowsAffected() == 0 {
		return domain.CatalogRequest{}, domain.ErrNotFound
	}
	return r.GetAdminCatalogRequest(ctx, requestID)
}
func (r *Repository) MergeAdminCatalogRequest(ctx context.Context, requestID, targetID string) (domain.CatalogRequest, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `INSERT INTO catalog_request_followers(request_id,user_id) SELECT $2::uuid,user_id FROM catalog_request_followers WHERE request_id=$1::uuid ON CONFLICT DO NOTHING`, requestID, targetID); err != nil {
		return domain.CatalogRequest{}, err
	}
	command, err := tx.Exec(ctx, `UPDATE catalog_requests SET status='rejected',admin_note='已合并到其他申请',merged_into_id=$2::uuid,updated_at=now(),completed_at=now() WHERE id=$1::uuid AND id<>$2::uuid AND merged_into_id IS NULL`, requestID, targetID)
	if err != nil {
		return domain.CatalogRequest{}, err
	}
	if command.RowsAffected() == 0 {
		return domain.CatalogRequest{}, domain.ErrInvalidInput
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.CatalogRequest{}, err
	}
	return r.GetAdminCatalogRequest(ctx, requestID)
}

func (r *Repository) ListPublicAnnouncements(ctx context.Context, limit int) ([]domain.Announcement, error) {
	rows, err := r.pool.Query(ctx, `SELECT id::text,title,summary,linked_agent_id::text,status,published_at,false FROM announcements WHERE status='published' ORDER BY published_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Announcement, 0)
	for rows.Next() {
		var a domain.Announcement
		if err := rows.Scan(&a.ID, &a.Title, &a.Summary, &nullableStringScanner{dest: &a.LinkedAgentID}, &a.Status, &a.PublishedAt, &a.Read); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
func (r *Repository) GetInbox(ctx context.Context, userID string) (domain.Inbox, error) {
	var inbox domain.Inbox
	rows, err := r.pool.Query(ctx, `SELECT id::text,notification_type,title,body,linked_agent_id::text,linked_request_id::text,read_at,created_at FROM notifications WHERE user_id=$1::uuid ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return inbox, err
	}
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(&n.ID, &n.NotificationType, &n.Title, &n.Body, &nullableStringScanner{dest: &n.LinkedAgentID}, &nullableStringScanner{dest: &n.LinkedRequestID}, &nullableTimeScanner{dest: &n.ReadAt}, &n.CreatedAt); err != nil {
			rows.Close()
			return inbox, err
		}
		inbox.Notifications = append(inbox.Notifications, n)
	}
	rows.Close()
	rows, err = r.pool.Query(ctx, `SELECT a.id::text,a.title,a.summary,a.linked_agent_id::text,a.status,a.published_at,(ar.user_id IS NOT NULL) FROM announcements a LEFT JOIN announcement_reads ar ON ar.announcement_id=a.id AND ar.user_id=$1::uuid WHERE a.status='published' ORDER BY a.published_at DESC LIMIT 30`, userID)
	if err != nil {
		return inbox, err
	}
	for rows.Next() {
		var a domain.Announcement
		if err := rows.Scan(&a.ID, &a.Title, &a.Summary, &nullableStringScanner{dest: &a.LinkedAgentID}, &a.Status, &a.PublishedAt, &a.Read); err != nil {
			rows.Close()
			return inbox, err
		}
		inbox.Announcements = append(inbox.Announcements, a)
	}
	rows.Close()
	for _, n := range inbox.Notifications {
		if n.ReadAt == nil {
			inbox.UnreadCount++
		}
	}
	for _, a := range inbox.Announcements {
		if !a.Read {
			inbox.UnreadCount++
		}
	}
	return inbox, nil
}
func (r *Repository) MarkNotificationRead(ctx context.Context, userID, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1::uuid AND user_id=$2::uuid`, id, userID)
	return err
}
func (r *Repository) MarkAnnouncementRead(ctx context.Context, userID, id string) error {
	_, err := r.pool.Exec(ctx, `INSERT INTO announcement_reads(announcement_id,user_id) SELECT id,$2::uuid FROM announcements WHERE id=$1::uuid AND status='published' ON CONFLICT DO NOTHING`, id, userID)
	return err
}
func (r *Repository) MarkInboxRead(ctx context.Context, userID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1::uuid`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO announcement_reads(announcement_id,user_id) SELECT id,$1::uuid FROM announcements WHERE status='published' ON CONFLICT DO NOTHING`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func escapeHTML(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&#34;", "'", "&#39;")
	return replacer.Replace(value)
}

func (r *Repository) ListPendingOutbox(ctx context.Context, limit int) ([]service.OutboxMessage, error) {
	rows, err := r.pool.Query(ctx, `UPDATE notification_outbox SET status='sending',attempt_count=attempt_count+1,updated_at=now() WHERE id IN (SELECT id FROM notification_outbox WHERE (status IN ('pending','failed') OR (status='sending' AND updated_at<now()-interval '10 minutes')) AND next_attempt_at<=now() AND attempt_count<8 ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING id::text,recipient,subject,text_body,html_body,attempt_count`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]service.OutboxMessage, 0)
	for rows.Next() {
		var m service.OutboxMessage
		if err := rows.Scan(&m.ID, &m.Recipient, &m.Subject, &m.TextBody, &m.HTMLBody, &m.AttemptCount); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func (r *Repository) MarkOutboxSent(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE notification_outbox SET status='sent',sent_at=now(),updated_at=now(),last_error='' WHERE id=$1::uuid`, id)
	return err
}
func (r *Repository) MarkOutboxFailed(ctx context.Context, id, errorMessage string, nextAttempt time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE notification_outbox SET status='failed',last_error=$2,next_attempt_at=$3,updated_at=now() WHERE id=$1::uuid`, id, errorMessage, nextAttempt)
	return err
}
