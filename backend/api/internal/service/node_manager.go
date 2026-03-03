package service

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/wydentis/iaas-mvp/api/internal/repo"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type NodeManager struct {
	Repo  *repo.NodeRepository
	conns map[string]*grpc.ClientConn
	mu    sync.RWMutex
}

func NewNodeManager(r *repo.NodeRepository) *NodeManager {
	return &NodeManager{
		Repo:  r,
		conns: make(map[string]*grpc.ClientConn),
	}
}

func (m *NodeManager) Init(ctx context.Context) error {
	nodes, err := m.Repo.ListNodes(ctx)
	if err != nil {
		return fmt.Errorf("failed to list nodes: %w", err)
	}

	for _, node := range nodes {
		if err := m.Connect(node.ID, node.IPAddress); err != nil {
			slog.Error("failed to connect to node", "node_id", node.ID, "ip", node.IPAddress, "error", err)
		}
	}
	return nil
}

func (m *NodeManager) Connect(nodeID, ipAddress string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.conns[nodeID]; exists {
		return nil
	}

	conn, err := grpc.NewClient(ipAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("failed to create grpc client: %w", err)
	}

	m.conns[nodeID] = conn
	slog.Info("connected to node", "node_id", nodeID, "addr", ipAddress)
	return nil
}

func (m *NodeManager) GetConnection(nodeID string) (*grpc.ClientConn, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conn, ok := m.conns[nodeID]
	if !ok {
		return nil, fmt.Errorf("connection not found for node %s", nodeID)
	}
	return conn, nil
}

func (m *NodeManager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, conn := range m.conns {
		if err := conn.Close(); err != nil {
			slog.Error("failed to close connection", "node_id", id, "error", err)
		}
	}

	m.conns = make(map[string]*grpc.ClientConn)
}
