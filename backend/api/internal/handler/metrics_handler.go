package handler

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	jsonutil "github.com/wydentis/iaas-mvp/api/internal/json"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
	"github.com/wydentis/iaas-mvp/api/internal/service"
	node "github.com/wydentis/iaas-mvp/backend/proto"
)

type MetricsHandler struct {
	NodeManager   *service.NodeManager
	ContainerRepo *repo.ContainerRepository
}

func NewMetricsHandler(nm *service.NodeManager, cr *repo.ContainerRepository) *MetricsHandler {
	return &MetricsHandler{
		NodeManager:   nm,
		ContainerRepo: cr,
	}
}

func (h *MetricsHandler) StreamMetrics(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	refreshMsStr := r.URL.Query().Get("refresh_ms")
	if refreshMsStr == "" {
		refreshMsStr = "1000"
	}

	refreshMs, err := strconv.Atoi(refreshMsStr)
	if err != nil || refreshMs < 100 {
		refreshMs = 1000
	}

	nodeID := r.URL.Query().Get("node_id")
	if nodeID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "node_id query parameter required")
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket", "err", err)
		return
	}
	defer conn.Close()

	// Get gRPC connection to node
	grpcConn, err := h.NodeManager.GetConnection(nodeID)
	if err != nil {
		slog.Error("failed to get node connection", "node_id", nodeID, "err", err)
		conn.WriteJSON(map[string]string{"error": "node not available"})
		return
	}

	// Create gRPC client and start stream
	client := node.NewNodeServiceClient(grpcConn)
	stream, err := client.StreamMetrics(context.Background(), &node.MetricsRequest{
		RefreshMs: int32(refreshMs),
	})
	if err != nil {
		slog.Error("failed to start metrics stream", "err", err)
		conn.WriteJSON(map[string]string{"error": "failed to start metrics stream"})
		return
	}

	// Forward gRPC stream to WebSocket
	for {
		metrics, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			slog.Error("failed to receive metrics", "err", err)
			break
		}

		// Send to WebSocket client
		if err := conn.WriteJSON(metrics); err != nil {
			slog.Error("failed to write to websocket", "err", err)
			break
		}
	}
}

func (h *MetricsHandler) StreamContainerMetrics(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, _ := r.Context().Value("role").(string)

	// Get container_id from path
	containerID := r.PathValue("id")
	if containerID == "" {
		jsonutil.Error(w, http.StatusBadRequest, "container id required")
		return
	}

	// Parse refresh_ms
	refreshMsStr := r.URL.Query().Get("refresh_ms")
	if refreshMsStr == "" {
		refreshMsStr = "1000"
	}

	refreshMs, err := strconv.Atoi(refreshMsStr)
	if err != nil || refreshMs < 100 {
		refreshMs = 1000
	}

	// Get container from DB to check ownership and get node_id
	container, err := h.ContainerRepo.GetContainerByID(r.Context(), containerID)
	if err != nil {
		jsonutil.Error(w, http.StatusNotFound, "container not found")
		return
	}

	// Check authorization
	if container.UserID != userID && role != "admin" {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket", "err", err)
		return
	}
	defer conn.Close()

	// Get gRPC connection using container's node_id
	grpcConn, err := h.NodeManager.GetConnection(container.NodeID)
	if err != nil {
		slog.Error("failed to get node connection", "node_id", container.NodeID, "err", err)
		conn.WriteJSON(map[string]string{"error": "node not available"})
		return
	}

	// Create gRPC client and start stream
	client := node.NewNodeServiceClient(grpcConn)
	stream, err := client.StreamContainerMetrics(context.Background(), &node.ContainerMetricsRequest{
		ContainerId: containerID,
		RefreshMs:   int32(refreshMs),
	})
	if err != nil {
		slog.Error("failed to start container metrics stream", "err", err)
		conn.WriteJSON(map[string]string{"error": "failed to start metrics stream"})
		return
	}

	// Forward gRPC stream to WebSocket
	for {
		metrics, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			slog.Error("failed to receive metrics", "err", err)
			break
		}

		if err := conn.WriteJSON(metrics); err != nil {
			slog.Error("failed to write to websocket", "err", err)
			break
		}
	}
}
