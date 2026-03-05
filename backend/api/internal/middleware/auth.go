package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/wydentis/iaas-mvp/api/internal/auth"
	"github.com/wydentis/iaas-mvp/api/internal/json"
)

func AuthMiddleware(next http.HandlerFunc, secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tokenString string
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		} else if t := r.URL.Query().Get("token"); t != "" {
			// Fallback to query parameter for WebSocket connections
			tokenString = t
		} else {
			json.Error(w, http.StatusUnauthorized, "token is required")
			return
		}

		claims, err := auth.ValidateToken(tokenString, secret, "access")
		if err != nil {
			json.Error(w, http.StatusUnauthorized, "token is invalid")
			return
		}

		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "role", claims.Role)
		next(w, r.WithContext(ctx))
	}
}

func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role, ok := r.Context().Value("role").(string)
		if !ok || role != "admin" {
			json.Error(w, http.StatusForbidden, "access denied")
			return
		}
		next(w, r)
	}
}
