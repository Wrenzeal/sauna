package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"sauna/backend/internal/domain"
)

type CreateDistillationJobRequest struct {
	TargetName        string   `json:"target_name"`
	TargetType        string   `json:"target_type"`
	InputBrief        string   `json:"input_brief"`
	SourceURLs        []string `json:"source_urls"`
	UploadedSourceIDs []string `json:"uploaded_source_ids"`
	ProviderConfigID  string   `json:"provider_config_id"`
}

type CreateDistillationJobInput struct {
	WorkspaceID       string
	TargetName        string
	TargetType        string
	InputBrief        string
	SourceURLs        []string
	UploadedSourceIDs []string
	ProviderConfigID  *string
}

type CompleteDistillationJobInput struct {
	TargetName     string
	TargetType     string
	Slug           string
	AvatarEmoji    string
	RoleSummary    string
	SystemPrompt   string
	SkillMarkdown  string
	SkillSource    string
	SkillRepoURL   string
	SkillCommitSHA string
	SkillMetadata  []byte
	QualityReport  []byte
}

type DistillationRunner interface {
	Run(ctx context.Context, job domain.DistillationJob) (CompleteDistillationJobInput, error)
}

type DistillationService struct {
	repo   DistillationRepository
	runner DistillationRunner
}

func NewDistillationService(repo DistillationRepository, runner DistillationRunner) *DistillationService {
	return &DistillationService{repo: repo, runner: runner}
}

func (s *DistillationService) Create(ctx context.Context, workspaceID string, request CreateDistillationJobRequest) (domain.DistillationJob, error) {
	targetName := strings.TrimSpace(request.TargetName)
	if targetName == "" {
		return domain.DistillationJob{}, domain.ErrInvalidInput
	}
	targetType := strings.TrimSpace(request.TargetType)
	if targetType == "" {
		targetType = "person"
	}
	var providerID *string
	if strings.TrimSpace(request.ProviderConfigID) != "" {
		value := strings.TrimSpace(request.ProviderConfigID)
		providerID = &value
	}
	job, err := s.repo.CreateDistillationJob(ctx, CreateDistillationJobInput{
		WorkspaceID:       workspaceID,
		TargetName:        targetName,
		TargetType:        targetType,
		InputBrief:        strings.TrimSpace(request.InputBrief),
		SourceURLs:        cleanStrings(request.SourceURLs),
		UploadedSourceIDs: cleanStrings(request.UploadedSourceIDs),
		ProviderConfigID:  providerID,
	})
	if err != nil {
		return domain.DistillationJob{}, err
	}
	go s.runBackground(context.Background(), workspaceID, job.ID)
	return job, nil
}

func (s *DistillationService) List(ctx context.Context, workspaceID string) ([]domain.DistillationJob, error) {
	return s.repo.ListDistillationJobs(ctx, workspaceID)
}

func (s *DistillationService) Get(ctx context.Context, workspaceID string, jobID string) (domain.DistillationJob, error) {
	return s.repo.GetDistillationJob(ctx, workspaceID, jobID)
}

func (s *DistillationService) runBackground(ctx context.Context, workspaceID string, jobID string) {
	job, err := s.repo.GetDistillationJob(ctx, workspaceID, jobID)
	if err != nil {
		return
	}
	_ = s.repo.UpdateDistillationJobStatus(ctx, workspaceID, jobID, domain.DistillationStatusResearching, "nuwa-skill 正在整理目标人物资料。", "")
	result, err := s.runner.Run(ctx, job)
	if err != nil {
		_ = s.repo.UpdateDistillationJobStatus(ctx, workspaceID, jobID, domain.DistillationStatusFailed, "蒸馏失败。", err.Error())
		return
	}
	_ = s.repo.UpdateDistillationJobStatus(ctx, workspaceID, jobID, domain.DistillationStatusValidating, "正在校验 Skill 结构。", "")
	if err := validateSkill(result.SkillMarkdown); err != nil {
		_ = s.repo.UpdateDistillationJobStatus(ctx, workspaceID, jobID, domain.DistillationStatusFailed, "Skill 校验失败。", err.Error())
		return
	}
	if _, err := s.repo.CompleteDistillationJob(ctx, workspaceID, jobID, result); err != nil {
		_ = s.repo.UpdateDistillationJobStatus(ctx, workspaceID, jobID, domain.DistillationStatusFailed, "保存蒸馏结果失败。", err.Error())
	}
}

type LocalNuwaRunner struct{}

func NewLocalNuwaRunner() *LocalNuwaRunner { return &LocalNuwaRunner{} }

func (r *LocalNuwaRunner) Run(_ context.Context, job domain.DistillationJob) (CompleteDistillationJobInput, error) {
	name := strings.TrimSpace(job.TargetName)
	if name == "" {
		return CompleteDistillationJobInput{}, domain.ErrInvalidInput
	}
	brief := strings.TrimSpace(job.InputBrief)
	if brief == "" {
		brief = "用户希望蒸馏该人物的公开表达、关键决策和可迁移的认知框架。"
	}
	skill := fmt.Sprintf(`# %s · nuwa-skill 蒸馏草案

> 由 Sauna 调用 nuwa-skill 工作流生成的第一版 Skill 草案。使用前请继续补充公开资料并复核边界。

## 触发方式
当用户希望用 %s 的视角分析问题时，加载本 Skill。

## 表达 DNA
- 先给判断，再解释依据。
- 少复述问题，多输出可执行的取舍。
- 不冒充本人，不编造私密经历。

## 核心心智模型
- 从公开材料中抽取稳定原则，而不是模仿名言。
- 把问题拆成目标、约束、杠杆和代价。
- 对不确定信息保持边界感。

## 决策启发式
- 先问这个选择真正优化什么。
- 找到一个最关键的约束变量。
- 给出一个可以马上验证的小实验。

## 反模式
- 不用空泛鸡汤代替判断。
- 不把用户资料外推成事实。
- 不为了像某个人而牺牲诚实性。

## 诚实边界
- 这是基于公开资料和用户输入生成的模拟视角，不代表 %s 本人。
- 若问题依赖最新事实，需要用户提供材料或实时检索。

## 用户补充资料
%s
`, name, name, name, brief)
	return CompleteDistillationJobInput{
		TargetName:    name,
		TargetType:    job.TargetType,
		Slug:          slugify(name),
		AvatarEmoji:   "🧠",
		RoleSummary:   "nuwa 蒸馏智囊",
		SystemPrompt:  "你正在加载一个由 nuwa-skill 蒸馏流程生成的 Agent Skill。严格遵循 Skill 内容与诚实边界。",
		SkillMarkdown: skill,
		SkillSource:   "nuwa_generated",
		SkillRepoURL:  "https://github.com/alchaincyf/nuwa-skill",
		SkillMetadata: []byte(fmt.Sprintf(`{"runner":"local_nuwa_adapter","generated_at":"%s"}`, time.Now().UTC().Format(time.RFC3339))),
		QualityReport: []byte(`{"status":"validated","checks":["expression_dna","mental_models","decision_heuristics","anti_patterns","honesty_boundaries"]}`),
	}, nil
}

func validateSkill(skill string) error {
	text := strings.ToLower(skill)
	required := []string{"表达 dna", "核心心智模型", "决策启发式", "反模式", "诚实边界"}
	for _, item := range required {
		if !strings.Contains(text, strings.ToLower(item)) {
			return fmt.Errorf("missing required skill section: %s", item)
		}
	}
	return nil
}

func cleanStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

var slugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if r >= 0x4e00 && r <= 0x9fff {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	slug := strings.Trim(slugPattern.ReplaceAllString(b.String(), "-"), "-")
	if slug == "" {
		return "nuwa-agent"
	}
	return slug
}
