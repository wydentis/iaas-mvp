package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/wydentis/iaas-mvp/api/internal/auth"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

var (
	ErrPasswordIncorrect = errors.New("password incorrect")
)

type UserService struct {
	Repo     repo.UserRepository
	JWTToken string
}

func NewUserService(r repo.UserRepository, jwt string) *UserService {
	return &UserService{r, jwt}
}

func (s *UserService) SignUp(ctx context.Context, req models.SignUpRequest) (*models.AuthResponse, error) {
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

	return s.generateTokens(user.ID)
}

func (s *UserService) SignIn(ctx context.Context, req models.SignInRequest) (*models.AuthResponse, error) {
	user := &models.User{}
	var err error
	if req.Username != "" {
		user, err = s.Repo.GetUserByUsername(ctx, req.Username)
	} else if req.Email != "" {
		user, err = s.Repo.GetUserByEmail(ctx, req.Email)
	} else if req.Phone != "" {
		user, err = s.Repo.GetUserByPhone(ctx, req.Phone)
	}

	if err != nil {
		return nil, err
	}

	if auth.CheckPasswordHash(req.Password, user.PasswordHash) {
		return s.generateTokens(user.ID)
	}

	return nil, ErrPasswordIncorrect
}

func (s *UserService) GetUserInfo(ctx context.Context, userID string) (*models.UserInfo, error) {
	user, err := s.Repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &models.UserInfo{
		Username: user.Username,
		Name:     user.Name,
		Surname:  user.Surname,
		Email:    user.Email,
		Phone:    user.Phone,
	}, nil
}

func (s *UserService) UpdateUserInfo(ctx context.Context, userID string, req models.UserInfo) (*models.UserInfo, error) {
	user := &models.User{
		ID:       userID,
		Username: req.Username,
		Name:     req.Name,
		Surname:  req.Surname,
		Email:    req.Email,
		Phone:    req.Phone,
	}

	user, err := s.Repo.UpdateUserInfo(ctx, user)
	if err != nil {
		slog.Error("failed to save user", "username", req.Username, "error", err)
		return nil, err
	}

	return &models.UserInfo{
		Username: user.Username,
		Name:     user.Name,
		Surname:  user.Surname,
		Email:    user.Email,
		Phone:    user.Phone,
	}, nil
}

func (s *UserService) UpdatePassword(ctx context.Context, userID, password string) error {
	return s.Repo.UpdatePassword(ctx, userID, password)
}

func (s *UserService) RefreshToken(ctx context.Context, req models.RefreshRequest) (*models.AuthResponse, error) {
	claims, err := auth.ValidateToken(req.RefreshToken, s.JWTToken, "refresh")
	if err != nil {
		return nil, err
	}

	user, err := s.Repo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}

	return s.generateTokens(user.ID)
}

func (s *UserService) generateTokens(userID string) (*models.AuthResponse, error) {
	accessToken, refreshToken, err := auth.GenerateTokens(userID, s.JWTToken)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    time.Now().Add(15 * time.Minute),
	}, nil
}
