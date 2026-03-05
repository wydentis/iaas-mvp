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

type NetworkHandler struct {
	Service *service.NetworkService
}

func NewNetworkHandler(s *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{s}
}

func (h *NetworkHandler) ListNetworks(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networks, err := h.Service.ListNetworks(r.Context(), userID)
	if err != nil {
		slog.Error("failed to list networks", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list networks")
		return
	}

	json.Encode(w, http.StatusOK, networks)
}

func (h *NetworkHandler) CreateNetwork(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	req, err := json.Decode[models.CreateNetworkRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		json.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	network, err := h.Service.CreateNetwork(r.Context(), userID, req)
	if err != nil {
		slog.Error("failed to create network", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to create network")
		return
	}

	json.Encode(w, http.StatusCreated, network)
}

func (h *NetworkHandler) GetNetwork(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	if networkID == "" {
		json.Error(w, http.StatusBadRequest, "network id required")
		return
	}

	network, err := h.Service.GetNetwork(r.Context(), userID, networkID)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to get network", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to get network")
		return
	}

	json.Encode(w, http.StatusOK, network)
}

func (h *NetworkHandler) UpdateNetwork(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	if networkID == "" {
		json.Error(w, http.StatusBadRequest, "network id required")
		return
	}

	req, err := json.Decode[models.UpdateNetworkRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	network, err := h.Service.UpdateNetwork(r.Context(), userID, networkID, req)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to update network", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to update network")
		return
	}

	json.Encode(w, http.StatusOK, network)
}

func (h *NetworkHandler) DeleteNetwork(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	if networkID == "" {
		json.Error(w, http.StatusBadRequest, "network id required")
		return
	}

	err := h.Service.DeleteNetwork(r.Context(), userID, networkID)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to delete network", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to delete network")
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *NetworkHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	if networkID == "" {
		json.Error(w, http.StatusBadRequest, "network id required")
		return
	}

	atts, err := h.Service.ListAttachments(r.Context(), userID, networkID)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to list attachments", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list attachments")
		return
	}

	json.Encode(w, http.StatusOK, atts)
}

func (h *NetworkHandler) AttachContainer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	if networkID == "" {
		json.Error(w, http.StatusBadRequest, "network id required")
		return
	}

	req, err := json.Decode[models.AttachContainerRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ContainerID == "" {
		json.Error(w, http.StatusBadRequest, "container_id is required")
		return
	}

	att, err := h.Service.AttachContainer(r.Context(), userID, networkID, req)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to attach container", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to attach container")
		return
	}

	json.Encode(w, http.StatusCreated, att)
}

func (h *NetworkHandler) DetachContainer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	networkID := r.PathValue("id")
	containerID := r.PathValue("container_id")
	if networkID == "" || containerID == "" {
		json.Error(w, http.StatusBadRequest, "network id and container id required")
		return
	}

	err := h.Service.DetachContainer(r.Context(), userID, networkID, containerID)
	if errors.Is(err, repo.ErrNetworkNotFound) {
		json.Error(w, http.StatusNotFound, "network not found")
		return
	} else if errors.Is(err, repo.ErrAttachmentNotFound) {
		json.Error(w, http.StatusNotFound, "attachment not found")
		return
	} else if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusForbidden, "access denied")
		return
	} else if err != nil {
		slog.Error("failed to detach container", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to detach container")
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *NetworkHandler) ListContainerNetworks(w http.ResponseWriter, r *http.Request) {
	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	networks, err := h.Service.ListContainerNetworks(r.Context(), containerID)
	if err != nil {
		slog.Error("failed to list container networks", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list container networks")
		return
	}

	json.Encode(w, http.StatusOK, networks)
}

func (h *NetworkHandler) ListPublicNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := h.Service.ListPublicNetworks(r.Context())
	if err != nil {
		slog.Error("failed to list public networks", "err", err)
		json.Error(w, http.StatusInternalServerError, "failed to list public networks")
		return
	}

	json.Encode(w, http.StatusOK, networks)
}
