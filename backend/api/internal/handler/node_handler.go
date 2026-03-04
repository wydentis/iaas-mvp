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

type NodeHandler struct {
	Service *service.NodeService
}

func NewNodeHandler(s *service.NodeService) *NodeHandler {
	return &NodeHandler{s}
}

func (h *NodeHandler) CreateNode(w http.ResponseWriter, r *http.Request) {
	req, err := json.Decode[models.CreateNodeRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	node, err := h.Service.CreateNode(r.Context(), req)
	if err != nil {
		slog.Error("failed to create node", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusCreated, node)
}

func (h *NodeHandler) GetNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("id")
	if nodeID == "" {
		json.Error(w, http.StatusBadRequest, "node id required")
		return
	}

	node, err := h.Service.GetNode(r.Context(), nodeID)
	if errors.Is(err, repo.ErrNodeNotFound) {
		json.Error(w, http.StatusNotFound, "node not found")
		return
	} else if err != nil {
		slog.Error("failed to get node", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, node)
}

func (h *NodeHandler) ListNodes(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.Service.ListNodes(r.Context())
	if err != nil {
		slog.Error("failed to list nodes", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, nodes)
}

func (h *NodeHandler) UpdateNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("id")
	if nodeID == "" {
		json.Error(w, http.StatusBadRequest, "node id required")
		return
	}

	req, err := json.Decode[models.UpdateNodeRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	node, err := h.Service.UpdateNode(r.Context(), nodeID, req)
	if errors.Is(err, repo.ErrNodeNotFound) {
		json.Error(w, http.StatusNotFound, "node not found")
		return
	} else if err != nil {
		slog.Error("failed to update node", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, node)
}

func (h *NodeHandler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("id")
	if nodeID == "" {
		json.Error(w, http.StatusBadRequest, "node id required")
		return
	}

	err := h.Service.DeleteNode(r.Context(), nodeID)
	if errors.Is(err, repo.ErrNodeNotFound) {
		json.Error(w, http.StatusNotFound, "node not found")
		return
	} else if err != nil {
		slog.Error("failed to delete node", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, "")
}

// Public endpoint - no auth required
func (h *NodeHandler) ListPublicNodes(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.Service.ListNodes(r.Context())
	if err != nil {
		slog.Error("failed to list nodes", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, nodes)
}
