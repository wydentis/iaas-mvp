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

	const pongWait = 60 * time.Second
	const pingInterval = 25 * time.Second

	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				return
			}
		}
	}()

	type incoming struct {
		cmd WSCommand
		err error
	}
	msgCh := make(chan incoming, 1)
	go func() {
		for {
			var cmd WSCommand
			if err := conn.ReadJSON(&cmd); err != nil {
				msgCh <- incoming{err: err}
				return
			}
			msgCh <- incoming{cmd: cmd}
		}
	}()

	for {
		in := <-msgCh
		if in.err != nil {
			slog.Error("failed to read message", "err", in.err)
			break
		}

		output, err := h.ContainerService.RunCommand(r.Context(), userID, role, containerID, in.cmd.Command)

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

		conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
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

	// Pong handler resets the read deadline each time a pong is received
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Ping goroutine — WriteControl is safe to call concurrently with writes
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				return
			}
		}
	}()

	// Reader goroutine — the only place conn.Read* is called
	type incoming struct {
		text string
		err  error
	}
	msgCh := make(chan incoming, 1)
	go func() {
		for {
			var msg WSChatMessage
			if err := conn.ReadJSON(&msg); err != nil {
				msgCh <- incoming{err: err}
				return
			}
			msgCh <- incoming{text: msg.Message}
		}
	}()

	for {
		in := <-msgCh
		if in.err != nil {
			slog.Error("failed to read chat message", "err", in.err)
			break
		}

		if in.text == "" {
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			conn.WriteJSON(WSChatResponse{Status: "error", Error: "message is required"})
			continue
		}

		// RPC call — no read deadline interference since reading is in its own goroutine
		chatResp, err := h.RabbitMQService.GetChatResponse(r.Context(), userID, in.text)

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
	}

	slog.Info("AI chat WebSocket disconnected", "userID", userID)
}

func (h *WebSocketHandler) ClearChatHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		jsonutil.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.RabbitMQService.ClearChatHistory(r.Context(), userID); err != nil {
		jsonutil.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
}
