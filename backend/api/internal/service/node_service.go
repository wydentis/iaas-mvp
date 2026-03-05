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
		TotalVCPU: req.TotalVCPU,
		TotalRAM:  req.TotalRAM,
		TotalDisk: req.TotalDisk,
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
		TotalVCPU: req.TotalVCPU,
		TotalRAM:  req.TotalRAM,
		TotalDisk: req.TotalDisk,
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

// ListNodesWithResources returns nodes enriched with usage info and dynamic prices.
func (s *NodeService) ListNodesWithResources(ctx context.Context) ([]*models.NodeWithResources, error) {
	nodes, err := s.Repo.ListNodesWithResources(ctx)
	if err != nil {
		return nil, err
	}
	for _, n := range nodes {
		cpuRatio := safeRatio(n.UsedCPU, n.TotalVCPU)
		ramRatio := safeRatio(n.UsedRAM, n.TotalRAM)
		diskRatio := safeRatio(n.UsedDisk, n.TotalDisk)
		n.DynCPUPrice = n.CPUPrice * (1 + cpuRatio)
		n.DynRAMPrice = n.RAMPrice * (1 + ramRatio)
		n.DynDiskPrice = n.DiskPrice * (1 + diskRatio)
	}
	return nodes, nil
}

func safeRatio(used, total int) float64 {
	if total <= 0 {
		return 0
	}
	r := float64(used) / float64(total)
	if r > 1 {
		r = 1
	}
	return r
}
