package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrPortMappingNotFound = errors.New("port mapping not found")
	ErrPortAlreadyInUse    = errors.New("port already in use")
)

type PortMappingRepository struct {
	Storage storage.Storage
}

func NewPortMappingRepository(stg storage.Storage) *PortMappingRepository {
	return &PortMappingRepository{stg}
}

func (r *PortMappingRepository) CreatePortMapping(ctx context.Context, pm *models.PortMapping) error {
	query := `
		INSERT INTO port_mappings (container_id, host_port, container_port, protocol)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	err := r.Storage.Pool.QueryRow(ctx, query,
		pm.ContainerID,
		pm.HostPort,
		pm.ContainerPort,
		pm.Protocol,
	).Scan(&pm.ID, &pm.CreatedAt, &pm.UpdatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *PortMappingRepository) GetPortMapping(ctx context.Context, id string) (*models.PortMapping, error) {
	pm := &models.PortMapping{}
	query := `
		SELECT id, container_id, host_port, container_port, protocol, created_at, updated_at
		FROM port_mappings
		WHERE id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, id).Scan(
		&pm.ID,
		&pm.ContainerID,
		&pm.HostPort,
		&pm.ContainerPort,
		&pm.Protocol,
		&pm.CreatedAt,
		&pm.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPortMappingNotFound
	}

	return pm, err
}

func (r *PortMappingRepository) ListPortMappingsByContainer(ctx context.Context, containerID string) ([]*models.PortMapping, error) {
	query := `
		SELECT id, container_id, host_port, container_port, protocol, created_at, updated_at
		FROM port_mappings
		WHERE container_id = $1
		ORDER BY host_port ASC
	`
	rows, err := r.Storage.Pool.Query(ctx, query, containerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mappings []*models.PortMapping
	for rows.Next() {
		pm := &models.PortMapping{}
		err := rows.Scan(
			&pm.ID,
			&pm.ContainerID,
			&pm.HostPort,
			&pm.ContainerPort,
			&pm.Protocol,
			&pm.CreatedAt,
			&pm.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		mappings = append(mappings, pm)
	}

	return mappings, nil
}

func (r *PortMappingRepository) IsHostPortAvailable(ctx context.Context, hostPort int32) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM port_mappings WHERE host_port = $1`
	err := r.Storage.Pool.QueryRow(ctx, query, hostPort).Scan(&count)
	if err != nil {
		return false, err
	}
	return count == 0, nil
}

func (r *PortMappingRepository) GetNextAvailablePort(ctx context.Context, startPort, endPort int32) (int32, error) {
	query := `
		SELECT $1 + s.i
		FROM generate_series(0, $2 - $1) AS s(i)
		WHERE NOT EXISTS (
			SELECT 1 FROM port_mappings WHERE host_port = $1 + s.i
		)
		LIMIT 1
	`
	var port int32
	err := r.Storage.Pool.QueryRow(ctx, query, startPort, endPort).Scan(&port)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, errors.New("no available ports in range")
	}
	return port, err
}

func (r *PortMappingRepository) UpdatePortMapping(ctx context.Context, id string, hostPort, containerPort int32) error {
	query := `
		UPDATE port_mappings
		SET host_port = $2, container_port = $3, updated_at = NOW()
		WHERE id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, id, hostPort, containerPort)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrPortMappingNotFound
	}

	return nil
}

func (r *PortMappingRepository) DeletePortMapping(ctx context.Context, id string) error {
	query := `DELETE FROM port_mappings WHERE id = $1`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, id)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrPortMappingNotFound
	}

	return nil
}

func (r *PortMappingRepository) DeleteAllByContainer(ctx context.Context, containerID string) error {
	query := `DELETE FROM port_mappings WHERE container_id = $1`
	_, err := r.Storage.Pool.Exec(ctx, query, containerID)
	return err
}
