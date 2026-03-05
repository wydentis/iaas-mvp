package handler

import (
	"log/slog"
	"net/http"
	"time"

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
	RabbitMQService  *service.RabbitMQService
}

func NewWebSocketHandler(cs *service.ContainerService, rmq *service.RabbitMQService) *WebSocketHandler {
	return &WebSocketHandler{
		ContainerService: cs,
		RabbitMQService:  rmq,
	}
}

type WSCommand struct {
	Command string `json:"command"`
}

type WSResponse struct {
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
}

type WSChatMessage struct {
	Message string `json:"message"`
}

type WSChatResponse struct {
	UserID   string `json:"user_id"`
	Response string `json:"response,omitempty"`
	Status   string `json:"status"`
	Error    string `json:"error,omitempty"`
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

// WebSocket endpoint for AI chat
func (h *WebSocketHandler) AIChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket", "err", err)
		return
	}
	defer conn.Close()

	slog.Info("AI chat WebSocket connected", "userID", userID)

	const pongWait = 60 * time.Second
	const pingInterval = 25 * time.Second

	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Ping goroutine to keep connection alive through proxies
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for range ticker.C {
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}()

	for {
		var msg WSChatMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			slog.Error("failed to read chat message", "err", err)
			break
		}

		if msg.Message == "" {
			conn.WriteJSON(WSChatResponse{
				Status: "error",
				Error:  "message is required",
			})
			continue
		}

		// Call RabbitMQ chat service
		ctx := r.Context()
		chatResp, err := h.RabbitMQService.GetChatResponse(ctx, userID, msg.Message)

		var response WSChatResponse
		if err != nil {
			response = WSChatResponse{
				Status: "error",
				Error:  "failed to get chat response: " + err.Error(),
			}
		} else if chatResp.Status == "error" {
			response = WSChatResponse{
				UserID: chatResp.UserID,
				Status: "error",
				Error:  chatResp.Message,
			}
		} else {
			response = WSChatResponse{
				UserID:   chatResp.UserID,
				Response: chatResp.Response,
				Status:   "success",
			}
		}

		conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
		if err := conn.WriteJSON(response); err != nil {
			slog.Error("failed to write chat response", "err", err)
			break
		}
		conn.SetReadDeadline(time.Now().Add(pongWait))
	}

	slog.Info("AI chat WebSocket disconnected", "userID", userID)
}
