package service

import (
	"context"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

type NodeService struct {
	Repo    *repo.NodeRepository
	Manager *NodeManager
}

func NewNodeService(r *repo.NodeRepository, m *NodeManager) *NodeService {
	return &NodeService{r, m}
}

func (s *NodeService) CreateNode(ctx context.Context, req models.CreateNodeRequest) (*models.Node, error) {
	node := &models.Node{
		Name:      req.Name,
		IPAddress: req.IPAddress,
		Status:    req.Status,
		CPUCores:  req.CPUCores,
		RAM:       req.RAM,
		DiskSpace: req.DiskSpace,
		CPUPrice:  req.CPUPrice,
		RAMPrice:  req.RAMPrice,
		DiskPrice: req.DiskPrice,
	}

	if err := s.Repo.CreateNode(ctx, node); err != nil {
		return nil, err
	}

	if err := s.Manager.Connect(node.ID, node.IPAddress); err != nil {
		return nil, err
	}

	return node, nil
}

func (s *NodeService) GetNode(ctx context.Context, nodeID string) (*models.Node, error) {
	return s.Repo.GetNodeByID(ctx, nodeID)
}

func (s *NodeService) ListNodes(ctx context.Context) ([]*models.Node, error) {
	return s.Repo.ListNodes(ctx)
}

func (s *NodeService) UpdateNode(ctx context.Context, nodeID string, req models.UpdateNodeRequest) (*models.Node, error) {
	node := &models.Node{
		ID:        nodeID,
		Name:      req.Name,
		IPAddress: req.IPAddress,
		Status:    req.Status,
		CPUCores:  req.CPUCores,
		RAM:       req.RAM,
		DiskSpace: req.DiskSpace,
		CPUPrice:  req.CPUPrice,
		RAMPrice:  req.RAMPrice,
		DiskPrice: req.DiskPrice,
	}

	if err := s.Repo.UpdateNode(ctx, node); err != nil {
		return nil, err
	}

	return s.Repo.GetNodeByID(ctx, nodeID)
}

func (s *NodeService) DeleteNode(ctx context.Context, nodeID string) error {
	return s.Repo.DeleteNode(ctx, nodeID)
}
