package json

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

func Decode[T any](r *http.Request) (T, error) {
	var payload T
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return payload, fmt.Errorf("decode json: %w", err)
	}
	return payload, nil
}

func Encode[T any](w http.ResponseWriter, status int, data T) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		return
	}
}

func Error(w http.ResponseWriter, status int, message string) {
	Encode(w, status, map[string]string{"error": message})
	slog.Error(message)
}
