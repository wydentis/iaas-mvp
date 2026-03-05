package service

import (
	"context"
	"errors"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
	node "github.com/wydentis/iaas-mvp/backend/proto"
)

type PortMappingService struct {
	PortRepo      *repo.PortMappingRepository
	ContainerRepo *repo.ContainerRepository
	NodeManager   *NodeManager
}

func NewPortMappingService(pr *repo.PortMappingRepository, cr *repo.ContainerRepository, nm *NodeManager) *PortMappingService {
	return &PortMappingService{
		PortRepo:      pr,
		ContainerRepo: cr,
		NodeManager:   nm,
	}
}

func (s *PortMappingService) CreatePortMapping(ctx context.Context, userID, role, containerID string, req models.CreatePortMappingRequest) (*models.PortMapping, error) {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return nil, err
	}

	if container.UserID != userID && role != "admin" {
		return nil, ErrUnauthorized
	}

	// Enforce max 10 port mappings per container
	existing, err := s.PortRepo.ListPortMappingsByContainer(ctx, containerID)
	if err != nil {
		return nil, err
	}
	if len(existing) >= 10 {
		return nil, errors.New("maximum 10 port mappings per container")
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	conn, err := s.NodeManager.GetConnection(container.NodeID)
	if err != nil {
		return nil, err
	}

	client := node.NewNodeServiceClient(conn)
	resp, err := client.CreatePortMapping(ctx, &node.CreatePortMappingRequest{
		ContainerId:   containerID,
		ContainerPort: req.ContainerPort,
		HostPort:      req.HostPort,
		Protocol:      req.Protocol,
	})

	if err != nil {
		return nil, err
	}

	if !resp.Success {
		return nil, errors.New(resp.ErrorMessage)
	}

	pm := &models.PortMapping{
		ContainerID:   containerID,
		HostPort:      resp.HostPort,
		ContainerPort: req.ContainerPort,
		Protocol:      req.Protocol,
	}

	if err := s.PortRepo.CreatePortMapping(ctx, pm); err != nil {
		return nil, err
	}

	return pm, nil
}

func (s *PortMappingService) GetPortMappings(ctx context.Context, userID, role, containerID string) ([]*models.PortMapping, error) {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return nil, err
	}

	if container.UserID != userID && role != "admin" {
		return nil, ErrUnauthorized
	}

	return s.PortRepo.ListPortMappingsByContainer(ctx, containerID)
}

func (s *PortMappingService) UpdatePortMapping(ctx context.Context, userID, role, containerID, mappingID string, req models.UpdatePortMappingRequest) error {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if container.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	pm, err := s.PortRepo.GetPortMapping(ctx, mappingID)
	if err != nil {
		return err
	}

	if pm.ContainerID != containerID {
		return errors.New("port mapping does not belong to this container")
	}

	conn, err := s.NodeManager.GetConnection(container.NodeID)
	if err != nil {
		return err
	}

	// Get all mappings from agent to find the correct agent mapping ID
	client := node.NewNodeServiceClient(conn)
	agentMappings, err := client.GetPortMappings(ctx, &node.GetPortMappingsRequest{
		ContainerId: containerID,
	})
	if err != nil {
		return err
	}

	if !agentMappings.Success {
		return errors.New(agentMappings.ErrorMessage)
	}

	// Find the agent mapping by matching old host_port and container_port
	var agentMappingID string
	for _, m := range agentMappings.Mappings {
		if m.HostPort == pm.HostPort && m.ContainerPort == pm.ContainerPort {
			agentMappingID = m.Id
			break
		}
	}

	if agentMappingID == "" {
		return errors.New("mapping not found on agent")
	}

	resp, err := client.UpdatePortMapping(ctx, &node.UpdatePortMappingRequest{
		ContainerId:   containerID,
		MappingId:     agentMappingID,
		HostPort:      req.HostPort,
		ContainerPort: req.ContainerPort,
	})

	if err != nil {
		return err
	}

	if !resp.Success {
		return errors.New(resp.ErrorMessage)
	}

	if err := s.PortRepo.UpdatePortMapping(ctx, mappingID, req.HostPort, req.ContainerPort); err != nil {
		return err
	}

	return nil
}

func (s *PortMappingService) DeletePortMapping(ctx context.Context, userID, role, containerID, mappingID string) error {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}

	if container.UserID != userID && role != "admin" {
		return ErrUnauthorized
	}

	pm, err := s.PortRepo.GetPortMapping(ctx, mappingID)
	if err != nil {
		return err
	}

	if pm.ContainerID != containerID {
		return errors.New("port mapping does not belong to this container")
	}

	conn, err := s.NodeManager.GetConnection(container.NodeID)
	if err != nil {
		return err
	}

	// Get all mappings from agent to find the correct agent mapping ID
	client := node.NewNodeServiceClient(conn)
	agentMappings, err := client.GetPortMappings(ctx, &node.GetPortMappingsRequest{
		ContainerId: containerID,
	})
	if err != nil {
		return err
	}

	if !agentMappings.Success {
		return errors.New(agentMappings.ErrorMessage)
	}

	// Find the agent mapping by matching host_port and container_port
	var agentMappingID string
	for _, m := range agentMappings.Mappings {
		if m.HostPort == pm.HostPort && m.ContainerPort == pm.ContainerPort {
			agentMappingID = m.Id
			break
		}
	}

	if agentMappingID == "" {
		return errors.New("mapping not found on agent")
	}

	resp, err := client.DeletePortMapping(ctx, &node.DeletePortMappingRequest{
		ContainerId: containerID,
		MappingId:   agentMappingID,
	})

	if err != nil {
		return err
	}

	if !resp.Success {
		return errors.New(resp.ErrorMessage)
	}

	if err := s.PortRepo.DeletePortMapping(ctx, mappingID); err != nil {
		return err
	}

	return nil
}
