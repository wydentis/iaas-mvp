package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrPublicIPNotFound    = errors.New("public IP not found")
	ErrPublicIPUnavailable = errors.New("public IP is already assigned")
)

type PublicIPRepository struct {
	Storage storage.Storage
}

func NewPublicIPRepository(stg storage.Storage) *PublicIPRepository {
	return &PublicIPRepository{stg}
}

func (r *PublicIPRepository) Create(ctx context.Context, pip *models.PublicIP) error {
	query := `
		INSERT INTO public_ips (node_id, ip_address, price_monthly)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`
	return r.Storage.Pool.QueryRow(ctx, query, pip.NodeID, pip.IPAddress, pip.PriceMonthly).
		Scan(&pip.ID, &pip.CreatedAt)
}

func (r *PublicIPRepository) ListByNode(ctx context.Context, nodeID string) ([]*models.PublicIP, error) {
	query := `
		SELECT id, node_id, ip_address, container_id, price_monthly, created_at
		FROM public_ips
		WHERE node_id = $1
		ORDER BY ip_address
	`
	rows, err := r.Storage.Pool.Query(ctx, query, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ips []*models.PublicIP
	for rows.Next() {
		pip := &models.PublicIP{}
		if err := rows.Scan(&pip.ID, &pip.NodeID, &pip.IPAddress, &pip.ContainerID, &pip.PriceMonthly, &pip.CreatedAt); err != nil {
			return nil, err
		}
		ips = append(ips, pip)
	}
	return ips, nil
}

func (r *PublicIPRepository) GetByID(ctx context.Context, id string) (*models.PublicIP, error) {
	pip := &models.PublicIP{}
	query := `
		SELECT id, node_id, ip_address, container_id, price_monthly, created_at
		FROM public_ips WHERE id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, id).Scan(
		&pip.ID, &pip.NodeID, &pip.IPAddress, &pip.ContainerID, &pip.PriceMonthly, &pip.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPublicIPNotFound
	}
	return pip, err
}

func (r *PublicIPRepository) Assign(ctx context.Context, ipID, containerID string) error {
	query := `
		UPDATE public_ips SET container_id = $2
		WHERE id = $1 AND container_id IS NULL
	`
	ct, err := r.Storage.Pool.Exec(ctx, query, ipID, containerID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrPublicIPUnavailable
	}
	return nil
}

func (r *PublicIPRepository) Release(ctx context.Context, containerID string) error {
	query := `UPDATE public_ips SET container_id = NULL WHERE container_id = $1`
	_, err := r.Storage.Pool.Exec(ctx, query, containerID)
	return err
}

func (r *PublicIPRepository) GetByContainer(ctx context.Context, containerID string) (*models.PublicIP, error) {
	pip := &models.PublicIP{}
	query := `
		SELECT id, node_id, ip_address, container_id, price_monthly, created_at
		FROM public_ips WHERE container_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, containerID).Scan(
		&pip.ID, &pip.NodeID, &pip.IPAddress, &pip.ContainerID, &pip.PriceMonthly, &pip.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPublicIPNotFound
	}
	return pip, err
}

func (r *PublicIPRepository) Delete(ctx context.Context, id string) error {
	ct, err := r.Storage.Pool.Exec(ctx, `DELETE FROM public_ips WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrPublicIPNotFound
	}
	return nil
}

func (r *PublicIPRepository) ListFreeByNode(ctx context.Context, nodeID string) ([]*models.PublicIP, error) {
	query := `
		SELECT id, node_id, ip_address, container_id, price_monthly, created_at
		FROM public_ips
		WHERE node_id = $1 AND container_id IS NULL
		ORDER BY ip_address
	`
	rows, err := r.Storage.Pool.Query(ctx, query, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ips []*models.PublicIP
	for rows.Next() {
		pip := &models.PublicIP{}
		if err := rows.Scan(&pip.ID, &pip.NodeID, &pip.IPAddress, &pip.ContainerID, &pip.PriceMonthly, &pip.CreatedAt); err != nil {
			return nil, err
		}
		ips = append(ips, pip)
	}
	return ips, nil
}
