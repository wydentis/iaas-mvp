package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrSnapshotNotFound = errors.New("snapshot not found")
)

type SnapshotRepository struct {
	Storage storage.Storage
}

func NewSnapshotRepository(stg storage.Storage) *SnapshotRepository {
	return &SnapshotRepository{stg}
}

func (r *SnapshotRepository) Create(ctx context.Context, s *models.Snapshot) error {
	query := `
		INSERT INTO snapshots (user_id, name, description, image, cpu, ram, disk, start_script, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING snapshot_id, created_at
	`
	return r.Storage.Pool.QueryRow(ctx, query,
		s.UserID, s.Name, s.Description, s.Image, s.CPU, s.RAM, s.Disk, s.StartScript, s.IsPublic,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *SnapshotRepository) GetByID(ctx context.Context, id string) (*models.Snapshot, error) {
	s := &models.Snapshot{}
	query := `
		SELECT snapshot_id, user_id, name, description, image, cpu, ram, disk, start_script, is_public, created_at
		FROM snapshots WHERE snapshot_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.UserID, &s.Name, &s.Description, &s.Image, &s.CPU, &s.RAM, &s.Disk, &s.StartScript, &s.IsPublic, &s.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSnapshotNotFound
	}
	return s, err
}

func (r *SnapshotRepository) ListPublic(ctx context.Context) ([]*models.Snapshot, error) {
	query := `
		SELECT snapshot_id, user_id, name, description, image, cpu, ram, disk, start_script, is_public, created_at
		FROM snapshots WHERE is_public = true ORDER BY created_at DESC
	`
	return r.scanList(ctx, query)
}

func (r *SnapshotRepository) ListByUser(ctx context.Context, userID string) ([]*models.Snapshot, error) {
	query := `
		SELECT snapshot_id, user_id, name, description, image, cpu, ram, disk, start_script, is_public, created_at
		FROM snapshots WHERE user_id = $1 ORDER BY created_at DESC
	`
	rows, err := r.Storage.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Snapshot
	for rows.Next() {
		s := &models.Snapshot{}
		if err := rows.Scan(&s.ID, &s.UserID, &s.Name, &s.Description, &s.Image, &s.CPU, &s.RAM, &s.Disk, &s.StartScript, &s.IsPublic, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *SnapshotRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.Storage.Pool.Exec(ctx, `DELETE FROM snapshots WHERE snapshot_id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrSnapshotNotFound
	}
	return nil
}

func (r *SnapshotRepository) scanList(ctx context.Context, query string, args ...interface{}) ([]*models.Snapshot, error) {
	rows, err := r.Storage.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Snapshot
	for rows.Next() {
		s := &models.Snapshot{}
		if err := rows.Scan(&s.ID, &s.UserID, &s.Name, &s.Description, &s.Image, &s.CPU, &s.RAM, &s.Disk, &s.StartScript, &s.IsPublic, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}
