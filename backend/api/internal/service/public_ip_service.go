package service

import (
	"context"
	"errors"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

type PublicIPService struct {
	Repo          *repo.PublicIPRepository
	ContainerRepo *repo.ContainerRepository
	UserRepo      *repo.UserRepository
}

func NewPublicIPService(r *repo.PublicIPRepository, cr *repo.ContainerRepository, ur *repo.UserRepository) *PublicIPService {
	return &PublicIPService{r, cr, ur}
}

func (s *PublicIPService) ListByNode(ctx context.Context, nodeID string) ([]*models.PublicIP, error) {
	return s.Repo.ListByNode(ctx, nodeID)
}

func (s *PublicIPService) ListFreeByNode(ctx context.Context, nodeID string) ([]*models.PublicIP, error) {
	return s.Repo.ListFreeByNode(ctx, nodeID)
}

func (s *PublicIPService) Assign(ctx context.Context, userID, containerID, ipID string) (*models.PublicIP, error) {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return nil, err
	}
	if container.UserID != userID {
		return nil, ErrUnauthorized
	}

	pip, err := s.Repo.GetByID(ctx, ipID)
	if err != nil {
		return nil, err
	}

	// Check balance
	cost := int(pip.PriceMonthly)
	if cost < 1 {
		cost = 1
	}
	bal, err := s.UserRepo.GetBalance(ctx, userID)
	if err != nil {
		return nil, err
	}
	if bal.Amount < cost {
		return nil, ErrInsufficientFunds
	}

	if err := s.Repo.Assign(ctx, ipID, containerID); err != nil {
		return nil, err
	}

	// Deduct balance
	_ = s.UserRepo.ChangeBalance(ctx, userID, -cost)

	pip.ContainerID = &containerID
	return pip, nil
}

func (s *PublicIPService) Release(ctx context.Context, userID, containerID string) error {
	container, err := s.ContainerRepo.GetContainerByID(ctx, containerID)
	if err != nil {
		return err
	}
	if container.UserID != userID {
		return ErrUnauthorized
	}
	return s.Repo.Release(ctx, containerID)
}

func (s *PublicIPService) GetByContainer(ctx context.Context, containerID string) (*models.PublicIP, error) {
	return s.Repo.GetByContainer(ctx, containerID)
}

// Admin methods
func (s *PublicIPService) Create(ctx context.Context, pip *models.PublicIP) error {
	return s.Repo.Create(ctx, pip)
}

func (s *PublicIPService) Delete(ctx context.Context, id string) error {
	return s.Repo.Delete(ctx, id)
}

func (s *PublicIPService) ListAll(ctx context.Context, nodeID string) ([]*models.PublicIP, error) {
	if nodeID != "" {
		return s.Repo.ListByNode(ctx, nodeID)
	}
	return nil, errors.New("node_id required")
}
