package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrContainerNotFound = errors.New("container not found")
)

type ContainerRepository struct {
	Storage storage.Storage
}

func NewContainerRepository(stg storage.Storage) *ContainerRepository {
	return &ContainerRepository{stg}
}

func (r *ContainerRepository) CreateContainer(ctx context.Context, container *models.Container) error {
	query := `
		INSERT INTO containers (node_id, user_id, name, image, cpu, ram, disk)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING container_id, status, created_at, updated_at
	`

	err := r.Storage.Pool.QueryRow(ctx, query,
		container.NodeID,
		container.UserID,
		container.Name,
		container.Image,
		container.CPU,
		container.RAM,
		container.Disk,
	).Scan(&container.ID, &container.Status, &container.CreatedAt, &container.UpdatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *ContainerRepository) GetContainerByID(ctx context.Context, containerID string) (*models.Container, error) {
	container := &models.Container{}
	query := `
		SELECT container_id, node_id, user_id, name, image, cpu, ram, disk, status, created_at, updated_at
		FROM containers
		WHERE container_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, containerID).Scan(
		&container.ID,
		&container.NodeID,
		&container.UserID,
		&container.Name,
		&container.Image,
		&container.CPU,
		&container.RAM,
		&container.Disk,
		&container.Status,
		&container.CreatedAt,
		&container.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrContainerNotFound
	}

	return container, err
}

func (r *ContainerRepository) ListContainersByNode(ctx context.Context, nodeID string) ([]*models.Container, error) {
	query := `
		SELECT container_id, node_id, user_id, name, image, cpu, ram, disk, status, created_at, updated_at
		FROM containers
		WHERE node_id = $1
	`
	rows, err := r.Storage.Pool.Query(ctx, query, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []*models.Container
	for rows.Next() {
		container := &models.Container{}
		err := rows.Scan(
			&container.ID,
			&container.NodeID,
			&container.UserID,
			&container.Name,
			&container.Image,
			&container.CPU,
			&container.RAM,
			&container.Disk,
			&container.Status,
			&container.CreatedAt,
			&container.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		containers = append(containers, container)
	}

	return containers, nil
}

func (r *ContainerRepository) ListContainersByUser(ctx context.Context, userID string) ([]*models.Container, error) {
	query := `
		SELECT container_id, node_id, user_id, name, image, cpu, ram, disk, status, created_at, updated_at
		FROM containers
		WHERE user_id = $1
	`
	rows, err := r.Storage.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []*models.Container
	for rows.Next() {
		container := &models.Container{}
		err := rows.Scan(
			&container.ID,
			&container.NodeID,
			&container.UserID,
			&container.Name,
			&container.Image,
			&container.CPU,
			&container.RAM,
			&container.Disk,
			&container.Status,
			&container.CreatedAt,
			&container.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		containers = append(containers, container)
	}

	return containers, nil
}

func (r *ContainerRepository) ListAllContainers(ctx context.Context) ([]*models.Container, error) {
	query := `
		SELECT container_id, node_id, user_id, name, image, cpu, ram, disk, status, created_at, updated_at
		FROM containers
	`
	rows, err := r.Storage.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []*models.Container
	for rows.Next() {
		container := &models.Container{}
		err := rows.Scan(
			&container.ID,
			&container.NodeID,
			&container.UserID,
			&container.Name,
			&container.Image,
			&container.CPU,
			&container.RAM,
			&container.Disk,
			&container.Status,
			&container.CreatedAt,
			&container.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		containers = append(containers, container)
	}

	return containers, nil
}

func (r *ContainerRepository) UpdateContainerStatus(ctx context.Context, containerID string, status models.ContainerStatus) error {
	query := `
		UPDATE containers
		SET status = $2, updated_at = NOW()
		WHERE container_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, containerID, status)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrContainerNotFound
	}

	return nil
}

func (r *ContainerRepository) DeleteContainer(ctx context.Context, containerID string) error {
	query := `
		DELETE FROM containers
		WHERE container_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, containerID)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrContainerNotFound
	}

	return nil
}

func (r *ContainerRepository) UpdateContainerInfo(ctx context.Context, containerID string, name string) error {
	query := `
		UPDATE containers
		SET name = $2, updated_at = NOW()
		WHERE container_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, containerID, name)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrContainerNotFound
	}

	return nil
}

func (r *ContainerRepository) UpdateContainerSpecs(ctx context.Context, containerID string, cpu, ram, disk int32) error {
	query := `
		UPDATE containers
		SET cpu = $2, ram = $3, disk = $4, updated_at = NOW()
		WHERE container_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, containerID, cpu, ram, disk)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrContainerNotFound
	}

	return nil
}

func (r *ContainerRepository) UpdateContainerNetwork(ctx context.Context, containerID string, ip string) error {
	query := `
		UPDATE containers
		SET ip_address = $2, updated_at = NOW()
		WHERE container_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, containerID, ip)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrContainerNotFound
	}

	return nil
}
