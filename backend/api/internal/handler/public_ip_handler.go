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

type PublicIPHandler struct {
	Service *service.PublicIPService
}

func NewPublicIPHandler(s *service.PublicIPService) *PublicIPHandler {
	return &PublicIPHandler{s}
}

// GET /nodes/{id}/public-ips — list free public IPs for a node (public, no auth)
func (h *PublicIPHandler) ListFreeByNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("id")
	if nodeID == "" {
		json.Error(w, http.StatusBadRequest, "node id required")
		return
	}
	ips, err := h.Service.ListFreeByNode(r.Context(), nodeID)
	if err != nil {
		slog.Error("failed to list public ips", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, ips)
}

// POST /vps/{id}/public-ip — assign a public IP to container
func (h *PublicIPHandler) Assign(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}
	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}
	type req struct {
		IPID string `json:"ip_id"`
	}
	body, err := json.Decode[req](r)
	if err != nil || body.IPID == "" {
		json.Error(w, http.StatusBadRequest, "ip_id required")
		return
	}
	pip, err := h.Service.Assign(r.Context(), userID, containerID, body.IPID)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	} else if errors.Is(err, service.ErrInsufficientFunds) {
		json.Error(w, http.StatusPaymentRequired, err.Error())
		return
	} else if errors.Is(err, repo.ErrPublicIPUnavailable) {
		json.Error(w, http.StatusConflict, "IP already assigned")
		return
	} else if err != nil {
		slog.Error("failed to assign public ip", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, pip)
}

// DELETE /vps/{id}/public-ip — release public IP from container
func (h *PublicIPHandler) Release(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}
	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}
	err := h.Service.Release(r.Context(), userID, containerID)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	} else if err != nil {
		slog.Error("failed to release public ip", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, "")
}

// GET /vps/{id}/public-ip — get public IP assigned to container
func (h *PublicIPHandler) GetByContainer(w http.ResponseWriter, r *http.Request) {
	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}
	pip, err := h.Service.GetByContainer(r.Context(), containerID)
	if errors.Is(err, repo.ErrPublicIPNotFound) {
		json.Encode(w, http.StatusOK, (*models.PublicIP)(nil))
		return
	} else if err != nil {
		slog.Error("failed to get public ip", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, pip)
}

// Admin: POST /admin/public-ips — create a public IP record
func (h *PublicIPHandler) AdminCreate(w http.ResponseWriter, r *http.Request) {
	type req struct {
		NodeID       string  `json:"node_id"`
		IPAddress    string  `json:"ip_address"`
		PriceMonthly float64 `json:"price_monthly"`
	}
	body, err := json.Decode[req](r)
	if err != nil || body.NodeID == "" || body.IPAddress == "" {
		json.Error(w, http.StatusBadRequest, "node_id and ip_address required")
		return
	}
	pip := &models.PublicIP{
		NodeID:       body.NodeID,
		IPAddress:    body.IPAddress,
		PriceMonthly: body.PriceMonthly,
	}
	if pip.PriceMonthly <= 0 {
		pip.PriceMonthly = 5
	}
	if err := h.Service.Create(r.Context(), pip); err != nil {
		slog.Error("failed to create public ip", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusCreated, pip)
}

// Admin: DELETE /admin/public-ips/{id}
func (h *PublicIPHandler) AdminDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		json.Error(w, http.StatusBadRequest, "id required")
		return
	}
	if err := h.Service.Delete(r.Context(), id); err != nil {
		slog.Error("failed to delete public ip", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, "")
}

// Admin: GET /admin/nodes/{id}/public-ips — list all public IPs for a node (including assigned)
func (h *PublicIPHandler) AdminListByNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("id")
	if nodeID == "" {
		json.Error(w, http.StatusBadRequest, "node id required")
		return
	}
	ips, err := h.Service.ListByNode(r.Context(), nodeID)
	if err != nil {
		slog.Error("failed to list public ips", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	json.Encode(w, http.StatusOK, ips)
}
