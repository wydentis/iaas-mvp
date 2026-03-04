package handler

import (
	"net/http"
	"time"

	"github.com/wydentis/iaas-mvp/api/internal/json"
)

func HealthCheck(w http.ResponseWriter, _ *http.Request) {
	json.Encode(w, http.StatusOK, time.Now())
}
