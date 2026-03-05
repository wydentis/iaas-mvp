package main

import (
	"log/slog"
	"net"
	"os"
	"strings"

	"github.com/wydentis/iaas-mvp/agent/internal/handler"
	"github.com/wydentis/iaas-mvp/agent/internal/iptables"
	"github.com/wydentis/iaas-mvp/agent/internal/provider"
	node "github.com/wydentis/iaas-mvp/backend/proto"
	"google.golang.org/grpc"
)

func main() {
	// Structured JSON logging
	logLevel := slog.LevelInfo
	if lvl := os.Getenv("LOG_LEVEL"); lvl != "" {
		switch strings.ToUpper(lvl) {
		case "DEBUG":
			logLevel = slog.LevelDebug
		case "WARN":
			logLevel = slog.LevelWarn
		case "ERROR":
			logLevel = slog.LevelError
		}
	}
	logHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel})
	slog.SetDefault(slog.New(logHandler))

	lxd, err := provider.NewLXD(os.Getenv("LXD_SOCKET"))
	if err != nil {
		slog.Error("failed to initialize LXD", "err", err)
		os.Exit(1)
	}

	iptablesManager, err := iptables.NewManager()
	if err != nil {
		slog.Error("failed to initialize iptables manager", "err", err)
		os.Exit(1)
	}

	// Load existing iptables rules
	if err := iptablesManager.LoadExistingMappings(); err != nil {
		slog.Warn("failed to load existing iptables mappings", "err", err)
	}

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := handler.NewServer(lxd, iptablesManager)
	s := grpc.NewServer(
		grpc.UnaryInterceptor(handler.LoggingInterceptor),
	)
	node.RegisterNodeServiceServer(s, server)
	slog.Info("gRPC server listening", "addr", ":50051", "log_level", logLevel.String())

	if err := s.Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}
