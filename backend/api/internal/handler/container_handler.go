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

type ContainerHandler struct {
	Service service.ContainerService
}

func NewContainerHandler(service service.ContainerService) *ContainerHandler {
	return &ContainerHandler{service}
}

func (h *ContainerHandler) CreateContainer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	createReq, err := json.Decode[models.CreateContainerRequest](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	container, err := h.Service.CreateContainer(r.Context(), userID, createReq)
	if err != nil {
		slog.Error("failed to create container", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusCreated, container)
}

func (h *ContainerHandler) GetContainer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	container, err := h.Service.GetContainer(r.Context(), userID, role, containerID)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		slog.Error("failed to get container", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, container)
}

func (h *ContainerHandler) ListAllContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := h.Service.ListAllContainers(r.Context())
	if err != nil {
		slog.Error("failed to list containers", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, containers)
}

func (h *ContainerHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	type statusReq struct {
		Status models.ContainerStatus `json:"status"`
	}

	req, err := json.Decode[statusReq](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.Service.SetContainerStatus(r.Context(), userID, role, containerID, req.Status)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		if err.Error() == "status not allowed" {
			json.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		slog.Error("failed to set container status", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *ContainerHandler) ListContainers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	containers, err := h.Service.ListContainers(r.Context(), userID)
	if err != nil {
		slog.Error("failed to list containers", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, containers)
}

func (h *ContainerHandler) DeleteContainer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	err := h.Service.DeleteContainer(r.Context(), userID, role, containerID)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		slog.Error("failed to delete container", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *ContainerHandler) UpdateInfo(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	type infoReq struct {
		Name string `json:"name"`
	}

	req, err := json.Decode[infoReq](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.Service.UpdateContainerInfo(r.Context(), userID, role, containerID, req.Name)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		slog.Error("failed to update container info", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *ContainerHandler) UpdateSpecs(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	type specsReq struct {
		CPU  int32 `json:"cpu"`
		RAM  int32 `json:"ram"`
		Disk int32 `json:"disk"`
	}

	req, err := json.Decode[specsReq](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.Service.UpdateContainerSpecs(r.Context(), userID, role, containerID, req.CPU, req.RAM, req.Disk)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		slog.Error("failed to update container specs", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, "")
}

func (h *ContainerHandler) RunCommand(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		slog.Error("failed to get userID from request context")
		json.Error(w, http.StatusInternalServerError, "failed to get token")
		return
	}

	role, _ := r.Context().Value("role").(string)

	containerID := r.PathValue("id")
	if containerID == "" {
		json.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	type commandReq struct {
		Command string `json:"command"`
	}

	req, err := json.Decode[commandReq](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	output, err := h.Service.RunCommand(r.Context(), userID, role, containerID, req.Command)
	if errors.Is(err, service.ErrUnauthorized) {
		json.Error(w, http.StatusUnauthorized, err.Error())
		return
	} else if errors.Is(err, repo.ErrContainerNotFound) {
		json.Error(w, http.StatusNotFound, "container not found")
		return
	} else if err != nil {
		slog.Error("failed to run command", "err", err)
		json.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	json.Encode(w, http.StatusOK, map[string]string{"output": output})
}

func (h *ContainerHandler) ListUserContainers(w http.ResponseWriter, r *http.Request) {
userID := r.PathValue("id")
if userID == "" {
json.Error(w, http.StatusBadRequest, "user id required")
return
}

containers, err := h.Service.ListContainers(r.Context(), userID)
if err != nil {
slog.Error("failed to list user containers", "err", err)
json.Error(w, http.StatusInternalServerError, err.Error())
return
}

json.Encode(w, http.StatusOK, containers)
}
