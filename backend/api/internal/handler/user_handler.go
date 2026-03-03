package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/wydentis/iaas-mvp/api/internal/auth"
	"github.com/wydentis/iaas-mvp/api/internal/json"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
	"github.com/wydentis/iaas-mvp/api/internal/service"
)

type UserHandler struct {
	Service service.UserService
}

func NewUserHandler(s service.UserService) *UserHandler {
	return &UserHandler{s}
}

func (h *UserHandler) SignUp(w http.ResponseWriter, r *http.Request) {
	req, err := json.Decode[models.SignUpRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Password != req.PasswordConfirm {
		json.Error(w, http.StatusBadRequest, "passwords do not match")
		return
	}

	cred, err := h.Service.SignUp(r.Context(), req)
	if errors.Is(err, repo.ErrUserAlreadyExists) {
		json.Error(w, http.StatusConflict, "user already exists")
		return
	} else if err != nil {
		slog.Error("Registration failed", "error", err)
		json.Error(w, http.StatusInternalServerError, "sign up failed")
		return
	}

	json.Encode(w, http.StatusCreated, cred)
}

func (h *UserHandler) SignIn(w http.ResponseWriter, r *http.Request) {
	req, err := json.Decode[models.SignInRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cred, err := h.Service.SignIn(r.Context(), req)
	if errors.Is(err, repo.ErrUserNotFound) {
		json.Error(w, http.StatusNotFound, "user not found")
		return
	} else if errors.Is(err, service.ErrPasswordIncorrect) {
		json.Error(w, http.StatusUnauthorized, "incorrect password")
		return
	} else if err != nil {
		slog.Error("sign in failed", "error", err)
		json.Error(w, http.StatusInternalServerError, "sign in in error")
		return
	}

	json.Encode(w, http.StatusOK, cred)
}

func (h *UserHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	req, err := json.Decode[models.RefreshRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cred, err := h.Service.RefreshToken(r.Context(), req)
	if err != nil {
		slog.Error("refresh failed", "error", err)
		json.Error(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	json.Encode(w, http.StatusOK, cred)
}

func (h *UserHandler) GetUserInfo(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	userInfo, err := h.Service.GetUserInfo(r.Context(), userID)
	if errors.Is(err, repo.ErrUserNotFound) {
		json.Error(w, http.StatusNotFound, "user not found")
		return
	} else if err != nil {
		slog.Error("failed to get user info", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to get user info")
		return
	}

	json.Encode(w, http.StatusOK, userInfo)
}

func (h *UserHandler) UpdateUserInfo(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	userUpdate, err := json.Decode[models.UserInfo](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userInfo, err := h.Service.UpdateUserInfo(r.Context(), userID, userUpdate)
	if errors.Is(err, repo.ErrUserAlreadyExists) {
		json.Error(w, http.StatusConflict, "user already exists")
		return
	} else if err != nil {
		json.Error(w, http.StatusInternalServerError, "failed to update user info")
		return
	}

	json.Encode(w, http.StatusOK, userInfo)
}

func (h *UserHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	psws, err := json.Decode[models.UserUpdatePasswordRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if psws.Password != psws.PasswordConfirm {
		json.Error(w, http.StatusBadRequest, "passwords do not match")
		return
	}

	hashPassword, err := auth.HashPassword(psws.Password)
	if err != nil {
		slog.Error("failed to update user info", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to update user info")
		return
	}

	err = h.Service.UpdatePassword(r.Context(), userID, hashPassword)
	if errors.Is(err, repo.ErrUserNotFound) {
		json.Error(w, http.StatusNotFound, "user not found")
		return
	} else if err != nil {
		slog.Error("failed to update user info", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to update user info")
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *UserHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	userBalance, err := h.Service.GetBalance(r.Context(), userID)
	if errors.Is(err, repo.ErrUserNotFound) {
		json.Error(w, http.StatusNotFound, "user not found")
	} else if err != nil {
		slog.Error("failed to get user balance", "error", err)
	}

	json.Encode(w, http.StatusOK, userBalance)
}

func (h *UserHandler) ChangeBalance(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	req, err := json.Decode[models.UserBalance](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.Service.ChangeBalance(r.Context(), userID, req.Amount)
	if errors.Is(err, repo.ErrUserNotFound) {
		json.Error(w, http.StatusNotFound, "user not found")
		return
	} else if err != nil {
		slog.Error("failed to update user info", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to update user info")
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Service.ListUsers(r.Context())
	if err != nil {
		slog.Error("failed to list users", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	json.Encode(w, http.StatusOK, users)
}

func (h *UserHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		json.Error(w, http.StatusBadRequest, "query parameter is required")
		return
	}

	users, err := h.Service.SearchUsers(r.Context(), query)
	if err != nil {
		slog.Error("failed to search users", "error", err)
		json.Error(w, http.StatusInternalServerError, "failed to search users")
		return
	}

	json.Encode(w, http.StatusOK, users)
}
