package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

var (
	ErrUserAlreadyExists = errors.New("user already exists")
)

type UserRepository struct {
	Storage storage.Storage
}

func NewUserRepository(stg storage.Storage) *UserRepository {
	return &UserRepository{stg}
}

func (r *UserRepository) CreateUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (username, name, surname, email, phone, password_hash)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING user_id, created_at, updated_at
	`

	err := r.Storage.Pool.QueryRow(ctx, query,
		user.Username,
		user.Name,
		user.Surname,
		user.Email,
		user.Phone,
		user.PasswordHash,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrUserAlreadyExists
		}
		return err
	}

	return nil
}
