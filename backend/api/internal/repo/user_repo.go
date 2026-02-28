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
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrUserNotFound      = errors.New("user not found")
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

func (r *UserRepository) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT *
		FROM users
		WHERE user_id = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Name,
		&user.Surname,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	return user, err
}

func (r *UserRepository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT *
		FROM users
		WHERE username = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.Name,
		&user.Surname,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	return user, err
}

func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT *
		FROM users
		WHERE email = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Username,
		&user.Name,
		&user.Surname,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	return user, err
}

func (r *UserRepository) GetUserByPhone(ctx context.Context, phone string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT *
		FROM users
		WHERE phone = $1
	`
	err := r.Storage.Pool.QueryRow(ctx, query, phone).Scan(
		&user.ID,
		&user.Username,
		&user.Name,
		&user.Surname,
		&user.Email,
		&user.Phone,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}

	return user, err
}
