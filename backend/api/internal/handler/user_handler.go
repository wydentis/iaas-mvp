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

func (h *UserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/auth/signup" {
		switch r.Method {
		case http.MethodPost:
			h.SignUp(w, r)
		default:
			json.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	} else {
		json.Error(w, http.StatusNotFound, "endpoint not found")
	}
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

	user, err := h.Service.SignUp(r.Context(), req)
	if errors.Is(err, repo.ErrUserAlreadyExists) {
		json.Error(w, http.StatusConflict, "user already exists")
		return
	} else if err != nil {
		slog.Error("Registration failed", "error", err)
		json.Error(w, http.StatusInternalServerError, "registration failed")
		return
	}

	json.Encode(w, http.StatusCreated, user)
}
