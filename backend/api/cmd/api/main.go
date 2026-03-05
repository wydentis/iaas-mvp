package main

import (
	"context"
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

	nodeRepo := repo.NewNodeRepository(*db)
	nodeManager := service.NewNodeManager(nodeRepo)
	if err := nodeManager.Init(context.Background()); err != nil {
		slog.Error("failed to init node manager", "err", err)
		os.Exit(1)
	}
	defer nodeManager.Close()

	containerRepo := repo.NewContainerRepository(*db)
	containerService := service.NewContainerService(*containerRepo, nodeManager)
	containerHandler := handler.NewContainerHandler(*containerService)

	nodeService := service.NewNodeService(nodeRepo, nodeManager)
	nodeHandler := handler.NewNodeHandler(nodeService)

	portMappingRepo := repo.NewPortMappingRepository(*db)
	portMappingService := service.NewPortMappingService(portMappingRepo, containerRepo, nodeManager)
	portMappingHandler := handler.NewPortMappingHandler(portMappingService)

	networkRepo := repo.NewNetworkRepository(*db)
	networkService := service.NewNetworkService(networkRepo)
	networkHandler := handler.NewNetworkHandler(networkService)

	snapshotRepo := repo.NewSnapshotRepository(*db)
	snapshotService := service.NewSnapshotService(snapshotRepo, *containerRepo)
	snapshotHandler := handler.NewSnapshotHandler(snapshotService)

	rabbitmqService, err := service.NewRabbitMQService(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("failed to connect to RabbitMQ", "err", err)
		os.Exit(1)
	}
	defer rabbitmqService.Close()
	aiHandler := handler.NewAIHandler(rabbitmqService)

	wsHandler := handler.NewWebSocketHandler(containerService, rabbitmqService)
	metricsHandler := handler.NewMetricsHandler(nodeManager, containerRepo)

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

	// admin
	mux.HandleFunc("GET /admin/users", middleware.AuthMiddleware(middleware.AdminMiddleware(userHandler.ListUsers), cfg.JWTSecret))
	mux.HandleFunc("GET /admin/user", middleware.AuthMiddleware(middleware.AdminMiddleware(userHandler.SearchUsers), cfg.JWTSecret))
	mux.HandleFunc("GET /admin/containers", middleware.AuthMiddleware(middleware.AdminMiddleware(containerHandler.ListAllContainers), cfg.JWTSecret))

	// nodes (admin only)
	mux.HandleFunc("POST /admin/nodes", middleware.AuthMiddleware(middleware.AdminMiddleware(nodeHandler.CreateNode), cfg.JWTSecret))
	mux.HandleFunc("GET /admin/nodes", middleware.AuthMiddleware(middleware.AdminMiddleware(nodeHandler.ListNodes), cfg.JWTSecret))
	mux.HandleFunc("GET /admin/nodes/{id}", middleware.AuthMiddleware(middleware.AdminMiddleware(nodeHandler.GetNode), cfg.JWTSecret))
	mux.HandleFunc("PUT /admin/nodes/{id}", middleware.AuthMiddleware(middleware.AdminMiddleware(nodeHandler.UpdateNode), cfg.JWTSecret))
	mux.HandleFunc("DELETE /admin/nodes/{id}", middleware.AuthMiddleware(middleware.AdminMiddleware(nodeHandler.DeleteNode), cfg.JWTSecret))

	// public nodes endpoint (no auth)
	mux.HandleFunc("GET /nodes", nodeHandler.ListPublicNodes)
	mux.HandleFunc("GET /networks/public", networkHandler.ListPublicNetworks)

	// container
	mux.HandleFunc("GET /vps", middleware.AuthMiddleware(containerHandler.ListContainers, cfg.JWTSecret))
	mux.HandleFunc("POST /vps", middleware.AuthMiddleware(containerHandler.CreateContainer, cfg.JWTSecret))
	mux.HandleFunc("GET /vps/{id}", middleware.AuthMiddleware(containerHandler.GetContainer, cfg.JWTSecret))
	mux.HandleFunc("DELETE /vps/{id}", middleware.AuthMiddleware(containerHandler.DeleteContainer, cfg.JWTSecret))
	mux.HandleFunc("PUT /vps/{id}/status", middleware.AuthMiddleware(containerHandler.SetStatus, cfg.JWTSecret))
	mux.HandleFunc("PUT /vps/{id}/info", middleware.AuthMiddleware(containerHandler.UpdateInfo, cfg.JWTSecret))
	mux.HandleFunc("PUT /vps/{id}/specs", middleware.AuthMiddleware(containerHandler.UpdateSpecs, cfg.JWTSecret))
	mux.HandleFunc("POST /vps/{id}/command", middleware.AuthMiddleware(containerHandler.RunCommand, cfg.JWTSecret))

	// websocket
	mux.HandleFunc("GET /vps/{id}/terminal", middleware.AuthMiddleware(wsHandler.ContainerTerminal, cfg.JWTSecret))

	// metrics (WebSocket)
	mux.HandleFunc("GET /admin/metrics", middleware.AuthMiddleware(middleware.AdminMiddleware(metricsHandler.StreamMetrics), cfg.JWTSecret))
	mux.HandleFunc("GET /vps/{id}/metrics", middleware.AuthMiddleware(metricsHandler.StreamContainerMetrics, cfg.JWTSecret))

	// port mappings
	mux.HandleFunc("POST /vps/{id}/ports", middleware.AuthMiddleware(portMappingHandler.CreatePortMapping, cfg.JWTSecret))
	mux.HandleFunc("GET /vps/{id}/ports", middleware.AuthMiddleware(portMappingHandler.GetPortMappings, cfg.JWTSecret))
	mux.HandleFunc("PUT /vps/{id}/ports/{mapping_id}", middleware.AuthMiddleware(portMappingHandler.UpdatePortMapping, cfg.JWTSecret))
	mux.HandleFunc("DELETE /vps/{id}/ports/{mapping_id}", middleware.AuthMiddleware(portMappingHandler.DeletePortMapping, cfg.JWTSecret))

	// networks
	mux.HandleFunc("GET /networks", middleware.AuthMiddleware(networkHandler.ListNetworks, cfg.JWTSecret))
	mux.HandleFunc("POST /networks", middleware.AuthMiddleware(networkHandler.CreateNetwork, cfg.JWTSecret))
	mux.HandleFunc("GET /networks/{id}", middleware.AuthMiddleware(networkHandler.GetNetwork, cfg.JWTSecret))
	mux.HandleFunc("PUT /networks/{id}", middleware.AuthMiddleware(networkHandler.UpdateNetwork, cfg.JWTSecret))
	mux.HandleFunc("DELETE /networks/{id}", middleware.AuthMiddleware(networkHandler.DeleteNetwork, cfg.JWTSecret))
	mux.HandleFunc("GET /networks/{id}/containers", middleware.AuthMiddleware(networkHandler.ListAttachments, cfg.JWTSecret))
	mux.HandleFunc("POST /networks/{id}/containers", middleware.AuthMiddleware(networkHandler.AttachContainer, cfg.JWTSecret))
	mux.HandleFunc("DELETE /networks/{id}/containers/{container_id}", middleware.AuthMiddleware(networkHandler.DetachContainer, cfg.JWTSecret))
	mux.HandleFunc("GET /vps/{id}/networks", middleware.AuthMiddleware(networkHandler.ListContainerNetworks, cfg.JWTSecret))

	// snapshots / marketplace
	mux.HandleFunc("GET /snapshots", snapshotHandler.ListPublic)
	mux.HandleFunc("GET /snapshots/my", middleware.AuthMiddleware(snapshotHandler.ListMy, cfg.JWTSecret))
	mux.HandleFunc("GET /snapshots/{id}", snapshotHandler.Get)
	mux.HandleFunc("POST /snapshots", middleware.AuthMiddleware(snapshotHandler.Create, cfg.JWTSecret))
	mux.HandleFunc("DELETE /snapshots/{id}", middleware.AuthMiddleware(snapshotHandler.Delete, cfg.JWTSecret))

	// AI endpoints
	mux.HandleFunc("POST /ai/hardware-recommendation", middleware.AuthMiddleware(aiHandler.GetHardwareRecommendation, cfg.JWTSecret))
	mux.HandleFunc("GET /ai/chat", middleware.AuthMiddleware(wsHandler.AIChat, cfg.JWTSecret))
	mux.HandleFunc("DELETE /ai/chat", middleware.AuthMiddleware(wsHandler.ClearChatHistory, cfg.JWTSecret))

	allowedOrigins := []string{
		"https://serverdam.wydentis.xyz",
		"http://localhost:5173",
		"http://localhost:4173",
		"http://localhost:3000",
	}
	corsHandler := middleware.CORSMiddleware(allowedOrigins)(mux)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      corsHandler,
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
