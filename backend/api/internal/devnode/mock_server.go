// Package devnode provides a mock gRPC node server for development and testing.
// Enable by setting DEV_NODE_ENABLED=true and optionally DEV_NODE_ADDR=host:port in the environment.
// Remove or disable this in production by setting DEV_NODE_ENABLED=false.
package devnode

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"net"
	"sync"
	"time"

	node "github.com/wydentis/iaas-mvp/backend/proto"
	"google.golang.org/grpc"
)

// container holds in-memory state of a mock container.
type container struct {
	status node.ContainerStatus
	ipv4   string
}

// MockServer is a fake LXD node gRPC server for local development.
type MockServer struct {
	node.UnimplementedNodeServiceServer

	mu           sync.RWMutex
	containers   map[string]*container
	portMappings map[string][]*node.PortMapping // containerID -> mappings

	grpcServer *grpc.Server
	listener   net.Listener
}

// NewMockServer creates a new MockServer.
func NewMockServer() *MockServer {
	return &MockServer{
		containers:   make(map[string]*container),
		portMappings: make(map[string][]*node.PortMapping),
	}
}

// Start starts the mock gRPC server on the given address.
func (s *MockServer) Start(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("devnode: failed to listen on %s: %w", addr, err)
	}
	s.listener = lis
	s.grpcServer = grpc.NewServer()
	node.RegisterNodeServiceServer(s.grpcServer, s)

	go func() {
		slog.Info("devnode: mock gRPC server started", "addr", addr)
		if err := s.grpcServer.Serve(lis); err != nil {
			slog.Info("devnode: mock gRPC server stopped", "reason", err)
		}
	}()
	return nil
}

// Stop gracefully stops the mock server.
func (s *MockServer) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
}

// Addr returns the listening address (useful when port=0 was used).
func (s *MockServer) Addr() string {
	if s.listener != nil {
		return s.listener.Addr().String()
	}
	return ""
}

// ---- NodeService implementation ----

func (s *MockServer) CreateVPS(_ context.Context, req *node.CreateRequest) (*node.CreateResponse, error) {
	ip := fmt.Sprintf("10.88.%d.%d", rand.Intn(255)+1, rand.Intn(254)+1)
	s.mu.Lock()
	s.containers[req.Id] = &container{status: node.ContainerStatus_RUNNING, ipv4: ip}
	s.mu.Unlock()
	slog.Info("devnode: CreateVPS", "id", req.Id, "image", req.Image, "ip", ip)
	return &node.CreateResponse{Success: true, Ipv4: ip}, nil
}

func (s *MockServer) GetVPS(_ context.Context, req *node.GetRequest) (*node.GetResponse, error) {
	s.mu.RLock()
	c, ok := s.containers[req.Id]
	s.mu.RUnlock()
	if !ok {
		return &node.GetResponse{Id: req.Id, Status: node.ContainerStatus_UNKNOWN}, nil
	}
	return &node.GetResponse{Id: req.Id, Status: c.status, Ipv4: c.ipv4}, nil
}

func (s *MockServer) SetVPSStatus(_ context.Context, req *node.SetStatusRequest) (*node.SetStatusResponse, error) {
	s.mu.Lock()
	if c, ok := s.containers[req.Id]; ok {
		c.status = req.Status
	}
	s.mu.Unlock()
	slog.Info("devnode: SetVPSStatus", "id", req.Id, "status", req.Status)
	return &node.SetStatusResponse{Success: true}, nil
}

func (s *MockServer) DeleteVPS(_ context.Context, req *node.DeleteRequest) (*node.DeleteResponse, error) {
	s.mu.Lock()
	delete(s.containers, req.Id)
	delete(s.portMappings, req.Id)
	s.mu.Unlock()
	slog.Info("devnode: DeleteVPS", "id", req.Id)
	return &node.DeleteResponse{Success: true}, nil
}

func (s *MockServer) UpdateVPS(_ context.Context, req *node.UpdateRequest) (*node.UpdateResponse, error) {
	slog.Info("devnode: UpdateVPS", "id", req.Id, "cpu", req.Cpu, "ram", req.Ram, "storage", req.Storage)
	return &node.UpdateResponse{Success: true}, nil
}

func (s *MockServer) RunCommand(_ context.Context, req *node.RunCommandRequest) (*node.RunCommandResponse, error) {
	slog.Info("devnode: RunCommand", "id", req.Id, "cmd", req.Command)
	return &node.RunCommandResponse{
		Success: true,
		Output:  fmt.Sprintf("[devnode] $ %s\nmock output\n", req.Command),
	}, nil
}

func (s *MockServer) CreatePortMapping(_ context.Context, req *node.CreatePortMappingRequest) (*node.CreatePortMappingResponse, error) {
	mappingID := fmt.Sprintf("pm-%d", time.Now().UnixNano())
	hostPort := req.HostPort
	if hostPort == 0 {
		hostPort = int32(30000 + rand.Intn(10000))
	}
	s.mu.Lock()
	s.portMappings[req.ContainerId] = append(s.portMappings[req.ContainerId], &node.PortMapping{
		Id:            mappingID,
		HostPort:      hostPort,
		ContainerPort: req.ContainerPort,
		Protocol:      req.Protocol,
	})
	s.mu.Unlock()
	return &node.CreatePortMappingResponse{Success: true, MappingId: mappingID, HostPort: hostPort}, nil
}

func (s *MockServer) GetPortMappings(_ context.Context, req *node.GetPortMappingsRequest) (*node.GetPortMappingsResponse, error) {
	s.mu.RLock()
	mappings := s.portMappings[req.ContainerId]
	s.mu.RUnlock()
	return &node.GetPortMappingsResponse{Success: true, Mappings: mappings}, nil
}

func (s *MockServer) UpdatePortMapping(_ context.Context, _ *node.UpdatePortMappingRequest) (*node.UpdatePortMappingResponse, error) {
	return &node.UpdatePortMappingResponse{Success: true}, nil
}

func (s *MockServer) DeletePortMapping(_ context.Context, req *node.DeletePortMappingRequest) (*node.DeletePortMappingResponse, error) {
	s.mu.Lock()
	ms := s.portMappings[req.ContainerId]
	for i, m := range ms {
		if m.Id == req.MappingId {
			s.portMappings[req.ContainerId] = append(ms[:i], ms[i+1:]...)
			break
		}
	}
	s.mu.Unlock()
	return &node.DeletePortMappingResponse{Success: true}, nil
}

func (s *MockServer) StreamMetrics(req *node.MetricsRequest, stream node.NodeService_StreamMetricsServer) error {
	interval := time.Duration(req.RefreshMs) * time.Millisecond
	if interval < 100*time.Millisecond {
		interval = 1 * time.Second
	}
	for {
		err := stream.Send(&node.MetricsResponse{
			Node: &node.NodeMetrics{
				NodeId:         "devnode",
				CpuPercent:     float32(10 + rand.Intn(40)),
				RamPercent:     float32(20 + rand.Intn(30)),
				DiskPercent:    float32(5 + rand.Intn(20)),
				NetworkRxBytes: int64(rand.Intn(1024 * 1024)),
				NetworkTxBytes: int64(rand.Intn(512 * 1024)),
			},
			Timestamp: time.Now().UnixMilli(),
		})
		if err != nil {
			return err
		}
		select {
		case <-stream.Context().Done():
			return nil
		case <-time.After(interval):
		}
	}
}

func (s *MockServer) StreamContainerMetrics(req *node.ContainerMetricsRequest, stream node.NodeService_StreamContainerMetricsServer) error {
	interval := time.Duration(req.RefreshMs) * time.Millisecond
	if interval < 100*time.Millisecond {
		interval = 1 * time.Second
	}
	for {
		err := stream.Send(&node.ContainerMetricsResponse{
			Metrics: &node.ContainerMetrics{
				ContainerId:    req.ContainerId,
				CpuPercent:     float32(5 + rand.Intn(30)),
				RamPercent:     float32(10 + rand.Intn(40)),
				DiskUsageBytes: int64(100 * 1024 * 1024),
				NetworkRxBytes: int64(rand.Intn(512 * 1024)),
				NetworkTxBytes: int64(rand.Intn(256 * 1024)),
			},
			Timestamp: time.Now().UnixMilli(),
		})
		if err != nil {
			return err
		}
		select {
		case <-stream.Context().Done():
			return nil
		case <-time.After(interval):
		}
	}
}
