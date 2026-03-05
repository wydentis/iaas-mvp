package service

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
	node "github.com/wydentis/iaas-mvp/backend/proto"
)

var (
	ErrUnauthorized      = errors.New("unauthorized")
	ErrInsufficientFunds = errors.New("insufficient balance")
	ErrNodeFull          = errors.New("node has no available resources")
)

type ContainerService struct {
	Repo     repo.ContainerRepository
	Nodes    *NodeManager
	NodeRepo *repo.NodeRepository
	UserRepo *repo.UserRepository
}

func NewContainerService(r repo.ContainerRepository, nm *NodeManager, nr *repo.NodeRepository, ur *repo.UserRepository) *ContainerService {
	return &ContainerService{r, nm, nr, ur}
}

func (s *ContainerService) CreateContainer(ctx context.Context, userID string, req models.CreateContainerRequest) (*models.Container, error) {
	// Calculate dynamic price and check balance
	cost, err := s.calculateCost(ctx, req.NodeID, int(req.CPU), int(req.RAM), int(req.Disk))
	if err != nil {
		return nil, err
	}

	balance, err := s.UserRepo.GetBalance(ctx, userID)
	if err != nil {
		return nil, err
	}
	if balance.Amount < cost {
		return nil, fmt.Errorf("%w: need %d BYN, have %d BYN", ErrInsufficientFunds, cost, balance.Amount)
	}

	conn, err := s.Nodes.GetConnection(req.NodeID)
	if err != nil {
		return nil, err
	}

	container := &models.Container{
		NodeID: req.NodeID,
		UserID: userID,
		Name:   req.Name,
		Image:  req.Image,
		CPU:    req.CPU,
		RAM:    req.RAM,
		Disk:   req.Disk,
	}

	err = s.Repo.CreateContainer(ctx, container)
	if err != nil {
		return nil, err
	}

	client := node.NewNodeServiceClient(conn)
	resp, err := client.CreateVPS(ctx, &node.CreateRequest{
		Id:          container.ID,
		Image:       container.Image,
		Cpu:         container.CPU,
		Ram:         container.RAM,
		Storage:     container.Disk,
		StartScript: req.StartScript,
	})
	if err != nil {
		return nil, err
	}
	if !resp.Success {
		return nil, errors.New(resp.ErrorMessage)
	}

	// Deduct balance
	if err := s.UserRepo.ChangeBalance(ctx, userID, -cost); err != nil {
		// Container already created on node — log but don't fail
	}

	container.IPAddress = resp.Ipv4

	if err := s.Repo.UpdateContainerNetwork(ctx, container.ID, resp.Ipv4); err != nil {
		// Log error but don't fail the request as the container is created
	}

	return container, nil
}

// calculateCost computes the monthly cost using dynamic pricing.
func (s *ContainerService) calculateCost(ctx context.Context, nodeID string, cpu, ramMB, diskGB int) (int, error) {
	nodes, err := s.NodeRepo.ListNodesWithResources(ctx)
	if err != nil {
		return 0, err
	}
	for _, n := range nodes {
		if n.ID != nodeID {
			continue
		}
		// Check capacity
		if n.UsedCPU+cpu > n.TotalVCPU || n.UsedRAM+ramMB > n.TotalRAM || n.UsedDisk+diskGB > n.TotalDisk {
			return 0, ErrNodeFull
		}
		cpuRatio := safeRatio(n.UsedCPU, n.TotalVCPU)
		ramRatio := safeRatio(n.UsedRAM, n.TotalRAM)
		diskRatio := safeRatio(n.UsedDisk, n.TotalDisk)
		cpuCost := float64(cpu) * n.CPUPrice * (1 + cpuRatio)
		ramCost := float64(ramMB) / 1024.0 * n.RAMPrice * (1 + ramRatio)
		diskCost := float64(diskGB) * n.DiskPrice * (1 + diskRatio)
		return int(math.Ceil(cpuCost + ramCost + diskCost)), nil
	}
	return 0, errors.New("node not found")
}

func (s *ContainerService) GetContainer(ctx context.Context, userID, role, containerID string) (*models.Container, error) {
	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return nil, err
	}

	if c.UserID != userID && role != "admin" {
		return nil, ErrUnauthorized
	}

	conn, err := s.Nodes.GetConnection(c.NodeID)
	if err != nil {
		return nil, err
	}

	client := node.NewNodeServiceClient(conn)
	resp, err := client.GetVPS(ctx, &node.GetRequest{Id: c.ID})
	if err != nil {
		return nil, err
	}

	if resp.ErrorMessage != "" {
		return nil, errors.New(resp.ErrorMessage)
	}

	switch resp.Status {
	case node.ContainerStatus_RUNNING:
		c.Status = models.ContainerStatusRunning
	case node.ContainerStatus_STOPPED:
		c.Status = models.ContainerStatusStopped
	case node.ContainerStatus_PENDING:
		c.Status = models.ContainerStatusPending
	case node.ContainerStatus_ERROR:
		c.Status = models.ContainerStatusError
	default:
		c.Status = models.ContainerStatusUnknown
	}

	c.IPAddress = resp.Ipv4

	return c, nil
}

func (s *ContainerService) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	return s.Repo.ListAllContainers(ctx)
}

func (s *ContainerService) SetContainerStatus(ctx context.Context, userID, role, containerID string, status models.ContainerStatus) error {
	if status != models.ContainerStatusRunning && status != models.ContainerStatusStopped {
		return errors.New("status not allowed")
	}

	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if c.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	conn, err := s.Nodes.GetConnection(c.NodeID)
	if err != nil {
		return err
	}

	client := node.NewNodeServiceClient(conn)

	var nodeStatus node.ContainerStatus
	switch status {
	case models.ContainerStatusRunning:
		nodeStatus = node.ContainerStatus_RUNNING
	case models.ContainerStatusStopped:
		nodeStatus = node.ContainerStatus_STOPPED
	}

	resp, err := client.SetVPSStatus(ctx, &node.SetStatusRequest{
		Id:     c.ID,
		Status: nodeStatus,
	})
	if err != nil {
		return err
	}

	if !resp.Success {
		return errors.New(resp.ErrorMessage)
	}

	return nil
}

func (s *ContainerService) ListContainers(ctx context.Context, userID string) ([]*models.Container, error) {
	return s.Repo.ListContainersByUser(ctx, userID)
}

func (s *ContainerService) DeleteContainer(ctx context.Context, userID, role, containerID string) error {
	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if c.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	conn, err := s.Nodes.GetConnection(c.NodeID)
	if err != nil {
		return err
	}

	client := node.NewNodeServiceClient(conn)

	// Attempt to delete from node, log error if fails but proceed to delete from DB
	// Or should we fail if node deletion fails? Usually better to try to cleanup both.
	// If node is down, we might want to allow force delete from DB?
	// For now, let's enforce node deletion first.

	resp, err := client.DeleteVPS(ctx, &node.DeleteRequest{
		Id: c.ID,
	})
	if err != nil {
		return err
	}

	if !resp.Success {
		return errors.New(resp.ErrorMessage)
	}

	return s.Repo.DeleteContainer(ctx, containerID)
}

func (s *ContainerService) UpdateContainerInfo(ctx context.Context, userID, role, containerID string, name string) error {
	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if c.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	return s.Repo.UpdateContainerInfo(ctx, containerID, name)
}

func (s *ContainerService) UpdateContainerSpecs(ctx context.Context, userID, role, containerID string, cpu, ram, disk int32) error {
	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if c.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	conn, err := s.Nodes.GetConnection(c.NodeID)
	if err != nil {
		return err
	}

	client := node.NewNodeServiceClient(conn)

	resp, err := client.UpdateVPS(ctx, &node.UpdateRequest{
		Id:      c.ID,
		Cpu:     cpu,
		Ram:     ram,
		Storage: disk,
	})
	if err != nil {
		return err
	}

	if !resp.Success {
		return errors.New(resp.ErrorMessage)
	}

	return s.Repo.UpdateContainerSpecs(ctx, containerID, cpu, ram, disk)
}

func (s *ContainerService) RunCommand(ctx context.Context, userID, role, containerID string, command string) (string, error) {
	c, err := s.Repo.GetContainerByID(ctx, containerID)
	if err != nil {
		return "", err
	}

	if c.UserID != userID && role != "admin" {
		return "", ErrUnauthorized
	}

	conn, err := s.Nodes.GetConnection(c.NodeID)
	if err != nil {
		return "", err
	}

	client := node.NewNodeServiceClient(conn)

	resp, err := client.RunCommand(ctx, &node.RunCommandRequest{
		Id:      c.ID,
		Command: command,
	})
	if err != nil {
		return "", err
	}

	if !resp.Success {
		return "", errors.New(resp.ErrorMessage)
	}

	return resp.Output, nil
}
