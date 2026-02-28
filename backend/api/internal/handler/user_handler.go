package handler

import (
	"errors"
	"log/slog"
	"net/http"

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
		json.Error(w, http.StatusInternalServerError, "registration failed")
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
		json.Error(w, http.StatusInternalServerError, "registration error")
		return
	}

	json.Encode(w, http.StatusOK, cred)
}
