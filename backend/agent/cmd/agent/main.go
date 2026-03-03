package main

import (
	"log/slog"
	"net"
	"os"

	"github.com/wydentis/iaas-mvp/agent/internal/handler"
	"github.com/wydentis/iaas-mvp/agent/internal/iptables"
	"github.com/wydentis/iaas-mvp/agent/internal/provider"
	node "github.com/wydentis/iaas-mvp/backend/proto"
	"google.golang.org/grpc"
)

func main() {
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
	s := grpc.NewServer()
	node.RegisterNodeServiceServer(s, server)
	slog.Info("gRPC server listening on :50051")

	if err := s.Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}
