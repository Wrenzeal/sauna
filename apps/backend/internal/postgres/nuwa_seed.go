package postgres

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type nuwaSeedAgent struct {
	DisplayName string
	Slug        string
	AvatarEmoji string
	RoleSummary string
	FileName    string
}

var nuwaSeedAgents = []nuwaSeedAgent{
	{DisplayName: "乔布斯", Slug: "steve-jobs", AvatarEmoji: "🍎", RoleSummary: "产品品味", FileName: "steve-jobs.md"},
	{DisplayName: "马斯克", Slug: "elon-musk", AvatarEmoji: "🚀", RoleSummary: "第一性原理", FileName: "elon-musk.md"},
	{DisplayName: "芒格", Slug: "munger", AvatarEmoji: "🧭", RoleSummary: "多元思维", FileName: "munger.md"},
	{DisplayName: "费曼", Slug: "feynman", AvatarEmoji: "⚛️", RoleSummary: "学习与解释", FileName: "feynman.md"},
	{DisplayName: "Naval", Slug: "naval", AvatarEmoji: "🌊", RoleSummary: "财富与杠杆", FileName: "naval.md"},
	{DisplayName: "Paul Graham", Slug: "paul-graham", AvatarEmoji: "✍️", RoleSummary: "创业与写作", FileName: "paul-graham.md"},
}

func SeedNuwaSkills(ctx context.Context, pool *pgxpool.Pool, seedDir string) error {
	seedDir = strings.TrimSpace(seedDir)
	if seedDir == "" {
		seedDir = "seed/nuwa-skills"
	}
	for _, agent := range nuwaSeedAgents {
		content, err := os.ReadFile(filepath.Join(seedDir, agent.FileName))
		if err != nil {
			return err
		}
		skill := strings.TrimSpace(string(content))
		if skill == "" {
			continue
		}
		if err := upsertNuwaSeedAgent(ctx, pool, agent, skill); err != nil {
			return err
		}
	}
	return nil
}

func upsertNuwaSeedAgent(ctx context.Context, pool *pgxpool.Pool, agent nuwaSeedAgent, skill string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var agentID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO agents(display_name, slug, avatar_emoji, role_summary, status, is_public_template)
		VALUES($1, $2, $3, $4, 'idle', true)
		ON CONFLICT (slug) WHERE is_public_template AND deleted_at IS NULL DO UPDATE SET
		  display_name=EXCLUDED.display_name,
		  avatar_emoji=EXCLUDED.avatar_emoji,
		  role_summary=EXCLUDED.role_summary,
		  updated_at=now()
		RETURNING id::text
	`, agent.DisplayName, agent.Slug, agent.AvatarEmoji, agent.RoleSummary).Scan(&agentID); err != nil {
		return err
	}

	systemPrompt := "你正在加载一个由 nuwa-skill 蒸馏完成的 Agent Skill。严格遵循 Skill 的认知框架、表达 DNA、决策启发式、反模式和诚实边界；明确说明这不是本人，只是基于公开资料提炼的思维方式。"
	var versionID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO agent_versions(agent_id, version_no, system_prompt, skill_markdown, expression_dna, mental_models, decision_heuristics, anti_patterns, honesty_boundaries, status, published_at, skill_source, skill_repo_url, skill_metadata, quality_report)
		VALUES($1::uuid, 1, $2, $3, '', '', '', '', '基于 nuwa-skill 成品 Skill，非本人观点。', 'published', now(), 'nuwa_prebuilt', 'https://github.com/alchaincyf/nuwa-skill', jsonb_build_object('seed_file', $4::text, 'source', 'nuwa-skill examples'), jsonb_build_object('status', 'imported'))
		ON CONFLICT(agent_id, version_no) DO UPDATE SET
		  system_prompt=EXCLUDED.system_prompt,
		  skill_markdown=EXCLUDED.skill_markdown,
		  honesty_boundaries=EXCLUDED.honesty_boundaries,
		  status='published',
		  published_at=COALESCE(agent_versions.published_at, now()),
		  skill_source=EXCLUDED.skill_source,
		  skill_repo_url=EXCLUDED.skill_repo_url,
		  skill_metadata=EXCLUDED.skill_metadata,
		  quality_report=EXCLUDED.quality_report,
		  updated_at=now()
		RETURNING id::text
	`, agentID, systemPrompt, skill, agent.FileName).Scan(&versionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE agents SET current_version_id=$2::uuid, updated_at=now() WHERE id=$1::uuid`, agentID, versionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
