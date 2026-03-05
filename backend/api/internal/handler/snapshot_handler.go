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

type SnapshotHandler struct {
	Service *service.SnapshotService
}

func NewSnapshotHandler(s *service.SnapshotService) *SnapshotHandler {
	return &SnapshotHandler{s}
}

func (h *SnapshotHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	req, err := json.Decode[models.CreateSnapshotRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.ContainerID == "" {
		json.Error(w, http.StatusBadRequest, "name and container_id are required")
		return
	}

	snap, err := h.Service.Create(r.Context(), userID, req)
	if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to create snapshot", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to create snapshot")
		return
	}

	json.Encode(w, http.StatusCreated, snap)
}

// ListPublic — no auth required, lists public marketplace snapshots
func (h *SnapshotHandler) ListPublic(w http.ResponseWriter, r *http.Request) {
	snaps, err := h.Service.ListPublic(r.Context())
	if err != nil {
		slog.Error("failed to list public snapshots", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list snapshots")
		return
	}
	json.Encode(w, http.StatusOK, snaps)
}

// ListMy — lists current user's snapshots
func (h *SnapshotHandler) ListMy(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	snaps, err := h.Service.ListMy(r.Context(), userID)
	if err != nil {
		slog.Error("failed to list user snapshots", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list snapshots")
		return
	}
	json.Encode(w, http.StatusOK, snaps)
}

// Get — get a single snapshot by ID (public or owned)
func (h *SnapshotHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		json.Error(w, http.StatusBadRequest, "snapshot id required")
		return
	}

	snap, err := h.Service.Get(r.Context(), id)
	if errors.Is(err, repo.ErrSnapshotNotFound) {
		json.Error(w, http.StatusNotFound, "snapshot not found")
		return
	} else if err != nil {
		slog.Error("failed to get snapshot", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to get snapshot")
		return
	}

	// Allow access if public; for private, check ownership
	if !snap.IsPublic {
		userID, ok := r.Context().Value("userID").(string)
		if !ok || snap.UserID != userID {
			json.Error(w, http.StatusForbidden, "access denied")
			return
		}
	}

	json.Encode(w, http.StatusOK, snap)
}

func (h *SnapshotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		json.Error(w, http.StatusBadRequest, "snapshot id required")
		return
	}

	err := h.Service.Delete(r.Context(), userID, id)
	if errors.Is(err, repo.ErrSnapshotNotFound) {
		json.Error(w, http.StatusNotFound, "snapshot not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to delete snapshot", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to delete snapshot")
		return
	}

	json.Encode(w, http.StatusOK, "")
}
