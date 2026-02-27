package service

import (
	"context"
	"log/slog"

	"github.com/wydentis/iaas-mvp/api/internal/auth"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

type UserService struct {
	Repo repo.UserRepository
}

func NewUserService(r repo.UserRepository) *UserService {
	return &UserService{r}
}

func (s *UserService) SignUp(ctx context.Context, req models.SignUpRequest) (*models.User, error) {
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		slog.Error("failed to hash password", "error", err)
		return nil, err
	}

	user := &models.User{
		Username:     req.Username,
		Name:         req.Name,
		Surname:      req.Surname,
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: hashedPassword,
	}

	if err := s.Repo.CreateUser(ctx, user); err != nil {
		slog.Error("failed to save user", "username", req.Username, "error", err)
		return nil, err
	}

	slog.Info("user registered successfully", "user_id", user.ID)
	return user, nil
}
