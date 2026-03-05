package repo

import (
	"context"
	"errors"
	"fmt"
	"math/rand"

	"github.com/jackc/pgx/v5"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrNetworkNotFound    = errors.New("network not found")
	ErrAttachmentNotFound = errors.New("attachment not found")
)

type NetworkRepository struct {
	Storage storage.Storage
}

func NewNetworkRepository(stg storage.Storage) *NetworkRepository {
	return &NetworkRepository{stg}
}

func generateSubnet() string {
	second := rand.Intn(256)
	third := rand.Intn(256)
	return fmt.Sprintf("10.%d.%d.0/24", second, third)
}

func gatewayFromSubnet(subnet string) string {
	// Extract base and replace last octet with 1
	var a, b, c int
	fmt.Sscanf(subnet, "%d.%d.%d.", &a, &b, &c)
	return fmt.Sprintf("%d.%d.%d.1", a, b, c)
}

func (r *NetworkRepository) CreateNetwork(ctx context.Context, network *models.Network) error {
	if network.Subnet == "" {
		network.Subnet = generateSubnet()
	}
	network.Gateway = gatewayFromSubnet(network.Subnet)

	query := `
		INSERT INTO networks (user_id, name, description, subnet, gateway, is_public)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING network_id, created_at, updated_at
	`
	return r.Storage.Pool.QueryRow(ctx, query,
		network.UserID,
		network.Name,
		network.Description,
		network.Subnet,
		network.Gateway,
		network.IsPublic,
	).Scan(&network.ID, &network.CreatedAt, &network.UpdatedAt)
}

func (r *NetworkRepository) GetNetworkByID(ctx context.Context, networkID string) (*models.Network, error) {
	n := &models.Network{}
	query := `
		SELECT network_id, user_id, name, description, subnet, gateway, is_public, created_at, updated_at
		FROM networks WHERE network_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, networkID).Scan(
		&n.ID, &n.UserID, &n.Name, &n.Description, &n.Subnet, &n.Gateway, &n.IsPublic, &n.CreatedAt, &n.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNetworkNotFound
	}
	return n, err
}

func (r *NetworkRepository) ListNetworksByUser(ctx context.Context, userID string) ([]*models.Network, error) {
	query := `
		SELECT network_id, user_id, name, description, subnet, gateway, is_public, created_at, updated_at
		FROM networks WHERE user_id = $1 ORDER BY created_at DESC
	`
	rows, err := r.Storage.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var networks []*models.Network
	for rows.Next() {
		n := &models.Network{}
		if err := rows.Scan(&n.ID, &n.UserID, &n.Name, &n.Description, &n.Subnet, &n.Gateway, &n.IsPublic, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		networks = append(networks, n)
	}
	return networks, nil
}

func (r *NetworkRepository) UpdateNetwork(ctx context.Context, networkID string, req models.UpdateNetworkRequest) (*models.Network, error) {
	n := &models.Network{}
	query := `
		UPDATE networks SET name = $2, description = $3, is_public = COALESCE($4, is_public), updated_at = NOW()
		WHERE network_id = $1
		RETURNING network_id, user_id, name, description, subnet, gateway, is_public, created_at, updated_at
	`
	err := r.Storage.Pool.QueryRow(ctx, query, networkID, req.Name, req.Description, req.IsPublic).Scan(
		&n.ID, &n.UserID, &n.Name, &n.Description, &n.Subnet, &n.Gateway, &n.IsPublic, &n.CreatedAt, &n.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNetworkNotFound
	}
	return n, err
}

func (r *NetworkRepository) DeleteNetwork(ctx context.Context, networkID string) error {
	tag, err := r.Storage.Pool.Exec(ctx, `DELETE FROM networks WHERE network_id = $1`, networkID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNetworkNotFound
	}
	return nil
}

// Attachments

func (r *NetworkRepository) AttachContainer(ctx context.Context, att *models.NetworkAttachment) error {
	query := `
		INSERT INTO network_attachments (network_id, container_id, ip_address)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`
	return r.Storage.Pool.QueryRow(ctx, query,
		att.NetworkID, att.ContainerID, att.IPAddress,
	).Scan(&att.ID, &att.CreatedAt)
}

func (r *NetworkRepository) DetachContainer(ctx context.Context, networkID, containerID string) error {
	tag, err := r.Storage.Pool.Exec(ctx,
		`DELETE FROM network_attachments WHERE network_id = $1 AND container_id = $2`,
		networkID, containerID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrAttachmentNotFound
	}
	return nil
}

func (r *NetworkRepository) ListAttachmentsByNetwork(ctx context.Context, networkID string) ([]*models.NetworkAttachment, error) {
	query := `
		SELECT id, network_id, container_id, ip_address, created_at
		FROM network_attachments WHERE network_id = $1 ORDER BY created_at
	`
	rows, err := r.Storage.Pool.Query(ctx, query, networkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var atts []*models.NetworkAttachment
	for rows.Next() {
		a := &models.NetworkAttachment{}
		if err := rows.Scan(&a.ID, &a.NetworkID, &a.ContainerID, &a.IPAddress, &a.CreatedAt); err != nil {
			return nil, err
		}
		atts = append(atts, a)
	}
	return atts, nil
}

func (r *NetworkRepository) ListNetworksByContainer(ctx context.Context, containerID string) ([]*models.Network, error) {
	query := `
		SELECT n.network_id, n.user_id, n.name, n.description, n.subnet, n.gateway, n.is_public, n.created_at, n.updated_at
		FROM networks n
		JOIN network_attachments na ON na.network_id = n.network_id
		WHERE na.container_id = $1
		ORDER BY n.created_at
	`
	rows, err := r.Storage.Pool.Query(ctx, query, containerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var networks []*models.Network
	for rows.Next() {
		n := &models.Network{}
		if err := rows.Scan(&n.ID, &n.UserID, &n.Name, &n.Description, &n.Subnet, &n.Gateway, &n.IsPublic, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		networks = append(networks, n)
	}
	return networks, nil
}

func (r *NetworkRepository) ListPublicNetworks(ctx context.Context) ([]*models.Network, error) {
	query := `
		SELECT network_id, user_id, name, description, subnet, gateway, is_public, created_at, updated_at
		FROM networks WHERE is_public = true ORDER BY created_at DESC
	`
	rows, err := r.Storage.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var networks []*models.Network
	for rows.Next() {
		n := &models.Network{}
		if err := rows.Scan(&n.ID, &n.UserID, &n.Name, &n.Description, &n.Subnet, &n.Gateway, &n.IsPublic, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		networks = append(networks, n)
	}
	return networks, nil
}
