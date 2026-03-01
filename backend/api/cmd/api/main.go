package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/wydentis/iaas-mvp/api/internal/config"
	"github.com/wydentis/iaas-mvp/api/internal/handler"
	"github.com/wydentis/iaas-mvp/api/internal/middleware"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
	"github.com/wydentis/iaas-mvp/api/internal/service"
	"github.com/wydentis/iaas-mvp/api/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	db, err := storage.New(cfg.DBConfig.GetDSN())
	if err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	userRepo := repo.NewUserRepository(*db)
	userService := service.NewUserService(*userRepo, cfg.JWTSecret)
	userHandler := handler.NewUserHandler(*userService)

	mux := http.NewServeMux()

	// healthcheck
	mux.HandleFunc("GET /health", handler.HealthCheck)

	// auth
	mux.HandleFunc("POST /auth/signup", userHandler.SignUp)
	mux.HandleFunc("POST /auth/signin", userHandler.SignIn)
	mux.HandleFunc("POST /auth/refresh", userHandler.RefreshToken)

	// user
	mux.HandleFunc("GET /user/info", middleware.AuthMiddleware(userHandler.GetUserInfo, cfg.JWTSecret))
	mux.HandleFunc("PUT /user/info", middleware.AuthMiddleware(userHandler.UpdateUserInfo, cfg.JWTSecret))
	mux.HandleFunc("PUT /user/pass", middleware.AuthMiddleware(userHandler.UpdatePassword, cfg.JWTSecret))
	mux.HandleFunc("GET /user/balance", middleware.AuthMiddleware(userHandler.GetBalance, cfg.JWTSecret))
	mux.HandleFunc("PUT /user/balance", middleware.AuthMiddleware(userHandler.ChangeBalance, cfg.JWTSecret))

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	slog.Info("server started", "port", cfg.Port)
	if err := server.ListenAndServe(); err != nil {
		slog.Error("listen error", "err", err)
		os.Exit(1)
	}
}
