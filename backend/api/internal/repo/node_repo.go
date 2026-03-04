package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrNodeAlreadyExists = errors.New("node already exists")
	ErrNodeNotFound      = errors.New("node not found")
)

type NodeRepository struct {
	Storage storage.Storage
}

func NewNodeRepository(stg storage.Storage) *NodeRepository {
	return &NodeRepository{stg}
}

func (r *NodeRepository) CreateNode(ctx context.Context, node *models.Node) error {
	query := `
		INSERT INTO nodes (name, ip_address, status, cpu_cores, ram, disk_space)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING node_id, created_at, updated_at
	`

	err := r.Storage.Pool.QueryRow(ctx, query,
		node.Name,
		node.IPAddress,
		node.Status,
		node.CPUCores,
		node.RAM,
		node.DiskSpace,
	).Scan(&node.ID, &node.CreatedAt, &node.UpdatedAt)

	if err != nil {
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "23505" {
			return ErrNodeAlreadyExists
		}
		return err
	}

	return nil
}

func (r *NodeRepository) GetNodeByID(ctx context.Context, nodeID string) (*models.Node, error) {
	node := &models.Node{}
	query := `
		SELECT node_id, name, ip_address, status, cpu_cores, ram, disk_space, created_at, updated_at
		FROM nodes
		WHERE node_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, nodeID).Scan(
		&node.ID,
		&node.Name,
		&node.IPAddress,
		&node.Status,
		&node.CPUCores,
		&node.RAM,
		&node.DiskSpace,
		&node.CreatedAt,
		&node.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNodeNotFound
	}

	return node, err
}

func (r *NodeRepository) ListNodes(ctx context.Context) ([]*models.Node, error) {
	query := `
		SELECT node_id, name, ip_address, status, cpu_cores, ram, disk_space, created_at, updated_at
		FROM nodes
	`
	rows, err := r.Storage.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []*models.Node
	for rows.Next() {
		node := &models.Node{}
		err := rows.Scan(
			&node.ID,
			&node.Name,
			&node.IPAddress,
			&node.Status,
			&node.CPUCores,
			&node.RAM,
			&node.DiskSpace,
			&node.CreatedAt,
			&node.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, node)
	}

	return nodes, nil
}

func (r *NodeRepository) UpdateNode(ctx context.Context, node *models.Node) error {
	query := `
		UPDATE nodes
		SET name = $2, ip_address = $3, status = $4, cpu_cores = $5, ram = $6, disk_space = $7, updated_at = NOW()
		WHERE node_id = $1
		RETURNING updated_at
	`
	err := r.Storage.Pool.QueryRow(ctx, query,
		node.ID,
		node.Name,
		node.IPAddress,
		node.Status,
		node.CPUCores,
		node.RAM,
		node.DiskSpace,
	).Scan(&node.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNodeNotFound
		}
		return err
	}

	return nil
}

func (r *NodeRepository) DeleteNode(ctx context.Context, nodeID string) error {
	query := `
		DELETE FROM nodes
		WHERE node_id = $1
	`
	commandTag, err := r.Storage.Pool.Exec(ctx, query, nodeID)
	if err != nil {
		return err
	}

	if commandTag.RowsAffected() == 0 {
		return ErrNodeNotFound
	}

	return nil
}
