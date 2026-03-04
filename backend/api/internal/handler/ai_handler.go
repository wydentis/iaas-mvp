package handler

import (
	"net/http"

	"github.com/wydentis/iaas-mvp/api/internal/json"
	"github.com/wydentis/iaas-mvp/api/internal/service"
)

type AIHandler struct {
	rabbitmq *service.RabbitMQService
}

func NewAIHandler(rabbitmq *service.RabbitMQService) *AIHandler {
	return &AIHandler{
		rabbitmq: rabbitmq,
	}
}

// POST /ai/hardware-recommendation
func (h *AIHandler) GetHardwareRecommendation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text"`
	}

	payload, err := json.Decode[struct {
		Text string `json:"text"`
	}](r)
	if err != nil {
		json.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req = payload

	if req.Text == "" {
		json.Error(w, http.StatusBadRequest, "text is required")
		return
	}

	response, err := h.rabbitmq.GetHardwareRecommendation(r.Context(), req.Text)
	if err != nil {
		json.Error(w, http.StatusInternalServerError, "failed to get hardware recommendation: "+err.Error())
		return
	}

	json.Encode(w, http.StatusOK, response)
}
