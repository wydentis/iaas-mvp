package service

import (
	"context"
	"fmt"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

type NetworkService struct {
	Repo          *repo.NetworkRepository
	ContainerRepo *repo.ContainerRepository
}

func NewNetworkService(r *repo.NetworkRepository, cr *repo.ContainerRepository) *NetworkService {
	return &NetworkService{Repo: r, ContainerRepo: cr}
}

func (s *NetworkService) CreateNetwork(ctx context.Context, userID string, req models.CreateNetworkRequest) (*models.Network, error) {
	n := &models.Network{
		UserID: userID,
		Name:   req.Name,
	}
	if req.Description != nil {
		n.Description = req.Description
	}
	if req.Subnet != nil && *req.Subnet != "" {
		n.Subnet = *req.Subnet
	}
	n.IsPublic = req.IsPublic

	if err := s.Repo.CreateNetwork(ctx, n); err != nil {
		return nil, err
	}
	return n, nil
}

func (s *NetworkService) GetNetwork(ctx context.Context, userID, networkID string) (*models.Network, error) {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return nil, err
	}
	if n.UserID != userID {
		return nil, ErrUnauthorized
	}
	return n, nil
}

func (s *NetworkService) ListNetworks(ctx context.Context, userID string) ([]*models.Network, error) {
	return s.Repo.ListNetworksByUser(ctx, userID)
}

func (s *NetworkService) UpdateNetwork(ctx context.Context, userID, networkID string, req models.UpdateNetworkRequest) (*models.Network, error) {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return nil, err
	}
	if n.UserID != userID {
		return nil, ErrUnauthorized
	}
	return s.Repo.UpdateNetwork(ctx, networkID, req)
}

func (s *NetworkService) DeleteNetwork(ctx context.Context, userID, networkID string) error {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return err
	}
	if n.UserID != userID {
		return ErrUnauthorized
	}
	return s.Repo.DeleteNetwork(ctx, networkID)
}

func (s *NetworkService) AttachContainer(ctx context.Context, userID, networkID string, req models.AttachContainerRequest) (*models.NetworkAttachment, error) {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return nil, err
	}
	if n.UserID != userID {
		return nil, ErrUnauthorized
	}

	// Use the container's actual IP address from the containers table
	container, err := s.ContainerRepo.GetContainerByID(ctx, req.ContainerID)
	if err != nil {
		return nil, fmt.Errorf("container not found: %w", err)
	}
	ipAddr := container.IPAddress

	att := &models.NetworkAttachment{
		NetworkID:   networkID,
		ContainerID: req.ContainerID,
		IPAddress:   ipAddr,
	}
	if err := s.Repo.AttachContainer(ctx, att); err != nil {
		return nil, err
	}
	return att, nil
}

func (s *NetworkService) DetachContainer(ctx context.Context, userID, networkID, containerID string) error {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return err
	}
	if n.UserID != userID {
		return ErrUnauthorized
	}
	return s.Repo.DetachContainer(ctx, networkID, containerID)
}

func (s *NetworkService) ListAttachments(ctx context.Context, userID, networkID string) ([]*models.NetworkAttachment, error) {
	n, err := s.Repo.GetNetworkByID(ctx, networkID)
	if err != nil {
		return nil, err
	}
	if n.UserID != userID {
		return nil, ErrUnauthorized
	}
	return s.Repo.ListAttachmentsByNetwork(ctx, networkID)
}

func (s *NetworkService) ListContainerNetworks(ctx context.Context, containerID string) ([]*models.Network, error) {
	return s.Repo.ListNetworksByContainer(ctx, containerID)
}

func (s *NetworkService) ListPublicNetworks(ctx context.Context) ([]*models.Network, error) {
	return s.Repo.ListPublicNetworks(ctx)
}
