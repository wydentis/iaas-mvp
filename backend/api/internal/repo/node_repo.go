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
		INSERT INTO nodes (name, ip_address, status, cpu_cores, ram, disk_space, total_vcpu, total_ram_mb, total_disk_gb, cpu_price, ram_price, disk_price)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING node_id, created_at, updated_at
	`

	err := r.Storage.Pool.QueryRow(ctx, query,
		node.Name,
		node.IPAddress,
		node.Status,
		node.CPUCores,
		node.RAM,
		node.DiskSpace,
		node.TotalVCPU,
		node.TotalRAM,
		node.TotalDisk,
		node.CPUPrice,
		node.RAMPrice,
		node.DiskPrice,
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
		SELECT node_id, name, ip_address, status, cpu_cores, ram, disk_space, total_vcpu, total_ram_mb, total_disk_gb, cpu_price, ram_price, disk_price, created_at, updated_at
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
		&node.TotalVCPU,
		&node.TotalRAM,
		&node.TotalDisk,
		&node.CPUPrice,
		&node.RAMPrice,
		&node.DiskPrice,
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
		SELECT node_id, name, ip_address, status, cpu_cores, ram, disk_space, total_vcpu, total_ram_mb, total_disk_gb, cpu_price, ram_price, disk_price, created_at, updated_at
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
			&node.TotalVCPU,
			&node.TotalRAM,
			&node.TotalDisk,
			&node.CPUPrice,
			&node.RAMPrice,
			&node.DiskPrice,
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
		SET name = $2, ip_address = $3, status = $4, cpu_cores = $5, ram = $6, disk_space = $7, total_vcpu = $8, total_ram_mb = $9, total_disk_gb = $10, cpu_price = $11, ram_price = $12, disk_price = $13, updated_at = NOW()
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
		node.TotalVCPU,
		node.TotalRAM,
		node.TotalDisk,
		node.CPUPrice,
		node.RAMPrice,
		node.DiskPrice,
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

// ListNodesWithResources returns all nodes enriched with used resources and free public IP count.
func (r *NodeRepository) ListNodesWithResources(ctx context.Context) ([]*models.NodeWithResources, error) {
	query := `
		SELECT
			n.node_id, n.name, n.ip_address, n.status,
			n.cpu_cores, n.ram, n.disk_space,
			n.total_vcpu, n.total_ram_mb, n.total_disk_gb,
			n.cpu_price, n.ram_price, n.disk_price,
			n.created_at, n.updated_at,
			COALESCE(u.used_cpu, 0),
			COALESCE(u.used_ram, 0),
			COALESCE(u.used_disk, 0),
			COALESCE(pip.free_ips, 0)
		FROM nodes n
		LEFT JOIN (
			SELECT node_id, SUM(cpu)::int AS used_cpu, SUM(ram)::int AS used_ram, SUM(disk)::int AS used_disk
			FROM containers
			GROUP BY node_id
		) u ON u.node_id = n.node_id
		LEFT JOIN (
			SELECT node_id, COUNT(*)::int AS free_ips
			FROM public_ips
			WHERE container_id IS NULL
			GROUP BY node_id
		) pip ON pip.node_id = n.node_id
	`
	rows, err := r.Storage.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.NodeWithResources
	for rows.Next() {
		nwr := &models.NodeWithResources{}
		err := rows.Scan(
			&nwr.ID, &nwr.Name, &nwr.IPAddress, &nwr.Status,
			&nwr.CPUCores, &nwr.RAM, &nwr.DiskSpace,
			&nwr.TotalVCPU, &nwr.TotalRAM, &nwr.TotalDisk,
			&nwr.CPUPrice, &nwr.RAMPrice, &nwr.DiskPrice,
			&nwr.CreatedAt, &nwr.UpdatedAt,
			&nwr.UsedCPU, &nwr.UsedRAM, &nwr.UsedDisk,
			&nwr.PublicIPsFree,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, nwr)
	}

	return result, nil
}
