package service

import (
	"context"

	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

type SnapshotService struct {
	Repo          *repo.SnapshotRepository
	ContainerRepo repo.ContainerRepository
}

func NewSnapshotService(r *repo.SnapshotRepository, cr repo.ContainerRepository) *SnapshotService {
	return &SnapshotService{r, cr}
}

func (s *SnapshotService) Create(ctx context.Context, userID string, req models.CreateSnapshotRequest) (*models.Snapshot, error) {
	c, err := s.ContainerRepo.GetContainerByID(ctx, req.ContainerID)
	if err != nil {
		return nil, err
	}
	if c.UserID != userID {
		return nil, ErrUnauthorized
	}

	snap := &models.Snapshot{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Image:       c.Image,
		CPU:         c.CPU,
		RAM:         c.RAM,
		Disk:        c.Disk,
		IsPublic:    req.IsPublic,
	}

	if err := s.Repo.Create(ctx, snap); err != nil {
		return nil, err
	}
	return snap, nil
}

func (s *SnapshotService) Get(ctx context.Context, id string) (*models.Snapshot, error) {
	snap, err := s.Repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// Public snapshots are visible to everyone; private only to owner (checked at handler level)
	return snap, nil
}

func (s *SnapshotService) ListPublic(ctx context.Context) ([]*models.Snapshot, error) {
	return s.Repo.ListPublic(ctx)
}

func (s *SnapshotService) ListMy(ctx context.Context, userID string) ([]*models.Snapshot, error) {
	return s.Repo.ListByUser(ctx, userID)
}

func (s *SnapshotService) Delete(ctx context.Context, userID, id string) error {
	snap, err := s.Repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if snap.UserID != userID {
		return ErrUnauthorized
	}
	return s.Repo.Delete(ctx, id)
}
