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
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			json.Error(w, http.StatusUnauthorized, "token is required")
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		claims, err := auth.ValidateToken(tokenString, secret, "access")
		if err != nil {
			json.Error(w, http.StatusUnauthorized, "token is invalid")
			return
		}

		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		next(w, r.WithContext(ctx))
	}
}
