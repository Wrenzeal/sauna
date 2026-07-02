package service

import (
	"context"

	"sauna/backend/internal/domain"
)

type AgentService struct {
	repo AgentRepository
}

func NewAgentService(repo AgentRepository) *AgentService {
	return &AgentService{repo: repo}
}

func (s *AgentService) ListPublic(ctx context.Context) ([]domain.Agent, error) {
	return s.repo.ListPublicAgents(ctx)
}

func (s *AgentService) ListWorkspace(ctx context.Context, workspaceID string) ([]domain.Agent, error) {
	return s.repo.ListWorkspaceAgents(ctx, workspaceID)
}

func (s *AgentService) ClonePublic(ctx context.Context, workspaceID string, agentID string) (domain.AgentWithVersion, error) {
	return s.repo.ClonePublicAgent(ctx, workspaceID, agentID)
}
