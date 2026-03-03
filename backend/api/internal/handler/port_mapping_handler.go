package handler

import (
	"net/http"

	jsonutil "github.com/wydentis/iaas-mvp/api/internal/json"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/service"
)

type PortMappingHandler struct {
	Service *service.PortMappingService
}

func NewPortMappingHandler(s *service.PortMappingService) *PortMappingHandler {
	return &PortMappingHandler{s}
}

func (h *PortMappingHandler) CreatePortMapping(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	req, err := jsonutil.Decode[models.CreatePortMappingRequest](r)
	if err != nil {
		jsonutil.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.ContainerPort <= 0 {
		jsonutil.Error(w, http.StatusBadRequest, "container_port is required")
		return
	}

	pm, err := h.Service.CreatePortMapping(r.Context(), userID, role, containerID, req)
	if err != nil {
		jsonutil.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonutil.Encode(w, http.StatusCreated, pm)
}

func (h *PortMappingHandler) GetPortMappings(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	mappings, err := h.Service.GetPortMappings(r.Context(), userID, role, containerID)
	if err != nil {
		jsonutil.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonutil.Encode(w, http.StatusOK, mappings)
}

func (h *PortMappingHandler) UpdatePortMapping(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	mappingID := r.PathValue("mapping_id")
	if mappingID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "mapping id required")
		return
	}

	req, err := jsonutil.Decode[models.UpdatePortMappingRequest](r)
	if err != nil {
		jsonutil.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.HostPort <= 0 || req.ContainerPort <= 0 {
		jsonutil.Error(w, http.StatusBadRequest, "host_port and container_port are required")
		return
	}

	err = h.Service.UpdatePortMapping(r.Context(), userID, role, containerID, mappingID, req)
	if err != nil {
		jsonutil.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonutil.Encode(w, http.StatusOK, map[string]string{"message": "port mapping updated"})
}

func (h *PortMappingHandler) DeletePortMapping(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	mappingID := r.PathValue("mapping_id")
	if mappingID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "mapping id required")
		return
	}

	err := h.Service.DeletePortMapping(r.Context(), userID, role, containerID, mappingID)
	if err != nil {
		jsonutil.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonutil.Encode(w, http.StatusOK, map[string]string{"message": "port mapping deleted"})
}
