package catalogpkg

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Manifest struct {
	SchemaVersion     int      `json:"schema_version"`
	Slug              string   `json:"slug"`
	DisplayName       string   `json:"display_name"`
	AvatarEmoji       string   `json:"avatar_emoji"`
	RoleSummary       string   `json:"role_summary"`
	Summary           string   `json:"summary"`
	Categories        []string `json:"categories"`
	Tags              []string `json:"tags"`
	NuwaCommitSHA     string   `json:"nuwa_commit_sha"`
	SourceDescription string   `json:"source_description"`
	SourceURLs        []string `json:"source_urls"`
	Featured          bool     `json:"featured"`
	SortOrder         int      `json:"sort_order"`
}
type Package struct {
	Manifest            Manifest
	SystemPrompt, Skill string
	Quality             json.RawMessage
	ContentHash         string
	ManifestJSON        []byte
}

func Load(dir string) (Package, error) {
	var p Package
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return p, errors.New("package directory is required")
	}
	manifestData, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return p, err
	}
	if err = json.Unmarshal(manifestData, &p.Manifest); err != nil {
		return p, fmt.Errorf("manifest: %w", err)
	}
	system, err := os.ReadFile(filepath.Join(dir, "SYSTEM_PROMPT.md"))
	if err != nil {
		return p, err
	}
	skill, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		return p, err
	}
	quality, err := os.ReadFile(filepath.Join(dir, "quality-report.json"))
	if err != nil {
		return p, err
	}
	if !json.Valid(quality) {
		return p, errors.New("quality-report.json is invalid JSON")
	}
	p.SystemPrompt = strings.TrimSpace(string(system))
	p.Skill = strings.TrimSpace(string(skill))
	p.Quality = json.RawMessage(quality)
	p.ManifestJSON = manifestData
	if err = p.Validate(); err != nil {
		return p, err
	}
	sum := sha256.Sum256([]byte(p.SystemPrompt + "\n" + p.Skill + "\n" + string(manifestData) + "\n" + string(quality)))
	p.ContentHash = hex.EncodeToString(sum[:])
	return p, nil
}

var catalogSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func (p Package) Validate() error {
	m := p.Manifest
	if m.SchemaVersion != 1 || strings.TrimSpace(m.Slug) == "" || strings.TrimSpace(m.DisplayName) == "" || strings.TrimSpace(m.Summary) == "" || strings.TrimSpace(p.SystemPrompt) == "" || strings.TrimSpace(p.Skill) == "" {
		return errors.New("manifest, system prompt and skill required fields are incomplete")
	}
	if !catalogSlugPattern.MatchString(m.Slug) {
		return errors.New("slug must use lowercase letters, numbers and single hyphens")
	}
	if len(m.Categories) == 0 {
		return errors.New("at least one category is required")
	}
	for _, raw := range m.SourceURLs {
		parsed, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
			return errors.New("source_urls must contain public http or https URLs")
		}
		host := strings.ToLower(parsed.Hostname())
		if host == "localhost" || strings.HasSuffix(host, ".localhost") {
			return errors.New("source_urls cannot target localhost")
		}
		if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified()) {
			return errors.New("source_urls cannot target private networks")
		}
	}
	text := strings.ToLower(p.Skill)
	for _, section := range []string{"表达 dna", "核心心智模型", "决策启发式", "反模式", "诚实边界"} {
		if !strings.Contains(text, section) {
			return fmt.Errorf("SKILL.md missing section %s", section)
		}
	}
	return nil
}
func Import(ctx context.Context, pool *pgxpool.Pool, p Package, requestID string) (string, int, bool, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", 0, false, err
	}
	defer tx.Rollback(ctx)
	var agentID string
	err = tx.QueryRow(ctx, `INSERT INTO agents(display_name,slug,avatar_emoji,role_summary,status,is_public_template) VALUES($1,$2,$3,$4,'idle',true) ON CONFLICT(slug) WHERE is_public_template AND deleted_at IS NULL DO UPDATE SET display_name=EXCLUDED.display_name,avatar_emoji=EXCLUDED.avatar_emoji,role_summary=EXCLUDED.role_summary,updated_at=now() RETURNING id::text`, p.Manifest.DisplayName, p.Manifest.Slug, p.Manifest.AvatarEmoji, p.Manifest.RoleSummary).Scan(&agentID)
	if err != nil {
		return "", 0, false, err
	}
	var existingHash string
	_ = tx.QueryRow(ctx, `SELECT content_hash FROM catalog_entries WHERE agent_id=$1::uuid`, agentID).Scan(&existingHash)
	createdVersion := existingHash != p.ContentHash
	versionNo := 0
	if createdVersion {
		if err = tx.QueryRow(ctx, `SELECT COALESCE(max(version_no),0)+1 FROM agent_versions WHERE agent_id=$1::uuid`, agentID).Scan(&versionNo); err != nil {
			return "", 0, false, err
		}
		var versionID string
		metadata, _ := json.Marshal(map[string]any{"manifest": p.Manifest, "content_hash": p.ContentHash})
		if err = tx.QueryRow(ctx, `INSERT INTO agent_versions(agent_id,version_no,system_prompt,skill_markdown,honesty_boundaries,status,published_at,skill_source,skill_repo_url,skill_commit_sha,skill_metadata,quality_report) VALUES($1::uuid,$2,$3,$4,'基于公开资料蒸馏，非本人观点。','published',now(),'nuwa_curated','https://github.com/alchaincyf/nuwa-skill',$5,$6::jsonb,$7::jsonb) RETURNING id::text`, agentID, versionNo, p.SystemPrompt, p.Skill, p.Manifest.NuwaCommitSHA, metadata, p.Quality).Scan(&versionID); err != nil {
			return "", 0, false, err
		}
		if _, err = tx.Exec(ctx, `UPDATE agents SET current_version_id=$2::uuid,updated_at=now() WHERE id=$1::uuid`, agentID, versionID); err != nil {
			return "", 0, false, err
		}
	} else {
		_ = tx.QueryRow(ctx, `SELECT COALESCE(max(version_no),0) FROM agent_versions WHERE agent_id=$1::uuid`, agentID).Scan(&versionNo)
	}
	sourceURLs, _ := json.Marshal(p.Manifest.SourceURLs)
	_, err = tx.Exec(ctx, `INSERT INTO catalog_entries(agent_id,summary,categories,tags,featured,sort_order,content_hash,source_description,source_urls,manifest,status,published_at) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'published',now()) ON CONFLICT(agent_id) DO UPDATE SET summary=EXCLUDED.summary,categories=EXCLUDED.categories,tags=EXCLUDED.tags,featured=EXCLUDED.featured,sort_order=EXCLUDED.sort_order,content_hash=EXCLUDED.content_hash,source_description=EXCLUDED.source_description,source_urls=EXCLUDED.source_urls,manifest=EXCLUDED.manifest,status='published',published_at=CASE WHEN catalog_entries.content_hash<>EXCLUDED.content_hash THEN now() ELSE catalog_entries.published_at END,updated_at=now()`, agentID, p.Manifest.Summary, p.Manifest.Categories, p.Manifest.Tags, p.Manifest.Featured, p.Manifest.SortOrder, p.ContentHash, p.Manifest.SourceDescription, sourceURLs, p.ManifestJSON)
	if err != nil {
		return "", 0, false, err
	}
	if strings.TrimSpace(requestID) != "" {
		command, err := tx.Exec(ctx, `UPDATE catalog_requests SET status='fulfilled',linked_agent_id=$2::uuid,admin_note=CASE WHEN admin_note='' THEN '人物已完成蒸馏并上架' ELSE admin_note END,completed_at=now(),updated_at=now() WHERE id=$1::uuid AND merged_into_id IS NULL`, requestID, agentID)
		if err != nil {
			return "", 0, false, err
		}
		if command.RowsAffected() == 0 {
			return "", 0, false, errors.New("request not found")
		}
		_, err = tx.Exec(ctx, `INSERT INTO notifications(user_id,notification_type,title,body,linked_agent_id,linked_request_id) SELECT f.user_id,'catalog_request_fulfilled',$2||' 已经上架','你申请或关注的人物已经进入人物大厅。',$3::uuid,$1::uuid FROM catalog_request_followers f WHERE f.request_id=$1::uuid`, requestID, p.Manifest.DisplayName, agentID)
		if err != nil {
			return "", 0, false, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO announcements(title,summary,linked_agent_id) VALUES($1,$2,$3::uuid)`, p.Manifest.DisplayName+" 已加入人物大厅", p.Manifest.Summary, agentID)
		if err != nil {
			return "", 0, false, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO notification_outbox(recipient,subject,text_body,html_body) SELECT DISTINCT u.email,$2,$3,$4 FROM catalog_request_followers f JOIN users u ON u.id=f.user_id WHERE f.request_id=$1::uuid`, requestID, "Sauna 人物上架："+p.Manifest.DisplayName, "你申请或关注的 "+p.Manifest.DisplayName+" 已经上架人物大厅。", "<p>你申请或关注的 <strong>"+html.EscapeString(p.Manifest.DisplayName)+"</strong> 已经上架 Sauna 人物大厅。</p>")
		if err != nil {
			return "", 0, false, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return "", 0, false, err
	}
	return agentID, versionNo, createdVersion, nil
}
