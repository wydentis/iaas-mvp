package handler

import (
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"
	jsonutil "github.com/wydentis/iaas-mvp/api/internal/json"
	"github.com/wydentis/iaas-mvp/api/internal/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketHandler struct {
	ContainerService *service.ContainerService
}

func NewWebSocketHandler(cs *service.ContainerService) *WebSocketHandler {
	return &WebSocketHandler{cs}
}

type WSCommand struct {
	Command string `json:"command"`
}

type WSResponse struct {
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
}

func (h *WebSocketHandler) ContainerTerminal(w http.ResponseWriter, r *http.Request) {
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

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket", "err", err)
		return
	}
	defer conn.Close()

	for {
		var cmd WSCommand
		err := conn.ReadJSON(&cmd)
		if err != nil {
			slog.Error("failed to read message", "err", err)
			break
		}

		output, err := h.ContainerService.RunCommand(r.Context(), userID, role, containerID, cmd.Command)

		var response WSResponse
		if err != nil {
			response = WSResponse{
				Error: err.Error(),
			}
		} else {
			response = WSResponse{
				Output: output,
			}
		}

		if err := conn.WriteJSON(response); err != nil {
			slog.Error("failed to write message", "err", err)
			break
		}
	}
}
