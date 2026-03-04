package handler

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/wydentis/iaas-mvp/agent/internal/container"
	"github.com/wydentis/iaas-mvp/agent/internal/iptables"
	"github.com/wydentis/iaas-mvp/agent/internal/metrics"
	"github.com/wydentis/iaas-mvp/agent/internal/provider"
	node "github.com/wydentis/iaas-mvp/backend/proto"
)

type PortManager interface {
	CreatePortMapping(containerID, containerIP string, containerPort, hostPort int32, protocol string) (string, int32, error)
	GetPortMappings(containerID string) []*iptables.PortMapping
	UpdatePortMapping(containerID, containerIP, mappingID string, hostPort, containerPort int32) error
	DeletePortMapping(containerID, containerIP, mappingID string) error
	CleanupContainer(containerID string) error
}

type Server struct {
	node.UnimplementedNodeServiceServer
	provider    provider.Provider
	portManager PortManager
}

func NewServer(provider provider.Provider, portManager PortManager) *Server {
	return &Server{
		provider:    provider,
		portManager: portManager,
	}
}

func (s *Server) CreateVPS(ctx context.Context, req *node.CreateRequest) (*node.CreateResponse, error) {
	specs := container.Specs{
		RAM:        req.Ram,
		CPUPercent: req.Cpu,
		Disk:       req.Storage,
	}

	ip, err := s.provider.CreateContainer(req.Id, req.Image, specs, req.StartScript)
	if err != nil {
		return &node.CreateResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.CreateResponse{Success: true, Ipv4: ip}, nil
}

func (s *Server) GetVPS(ctx context.Context, req *node.GetRequest) (*node.GetResponse, error) {
	c, err := s.provider.GetContainer(req.Id)
	if err != nil {
		return &node.GetResponse{ErrorMessage: err.Error()}, nil
	}

	var status node.ContainerStatus
	switch c.Status {
	case container.ContainerStatusRunning:
		status = node.ContainerStatus_RUNNING
	case container.ContainerStatusStopped:
		status = node.ContainerStatus_STOPPED
	default:
		status = node.ContainerStatus_UNKNOWN
	}

	return &node.GetResponse{
		Id:     c.ID,
		Status: status,
		Ipv4:   c.IPv4,
	}, nil
}

func (s *Server) SetVPSStatus(ctx context.Context, req *node.SetStatusRequest) (*node.SetStatusResponse, error) {
	var status container.ContainerStatus
	switch req.Status {
	case node.ContainerStatus_RUNNING:
		status = container.ContainerStatusRunning
	case node.ContainerStatus_STOPPED:
		status = container.ContainerStatusStopped
	default:
		return &node.SetStatusResponse{Success: false, ErrorMessage: "invalid status"}, nil
	}

	err := s.provider.SetStatus(req.Id, status)
	if err != nil {
		return &node.SetStatusResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.SetStatusResponse{Success: true}, nil
}

func (s *Server) DeleteVPS(ctx context.Context, req *node.DeleteRequest) (*node.DeleteResponse, error) {
	err := s.provider.DeleteContainer(req.Id)
	if err != nil {
		return &node.DeleteResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	if err := s.portManager.CleanupContainer(req.Id); err != nil {
		return &node.DeleteResponse{Success: false, ErrorMessage: fmt.Sprintf("container deleted but port cleanup failed: %v", err)}, nil
	}

	return &node.DeleteResponse{Success: true}, nil
}

func (s *Server) UpdateVPS(ctx context.Context, req *node.UpdateRequest) (*node.UpdateResponse, error) {
	specs := container.Specs{
		RAM:        req.Ram,
		CPUPercent: req.Cpu,
		Disk:       req.Storage,
	}

	err := s.provider.UpdateSpecs(req.Id, specs)
	if err != nil {
		return &node.UpdateResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.UpdateResponse{Success: true}, nil
}

func (s *Server) RunCommand(ctx context.Context, req *node.RunCommandRequest) (*node.RunCommandResponse, error) {
	output, err := s.provider.RunCommand(req.Id, req.Command)
	if err != nil {
		return &node.RunCommandResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.RunCommandResponse{Success: true, Output: output}, nil
}

func (s *Server) CreatePortMapping(ctx context.Context, req *node.CreatePortMappingRequest) (*node.CreatePortMappingResponse, error) {
	c, err := s.provider.GetContainer(req.ContainerId)
	if err != nil {
		return &node.CreatePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	mappingID, hostPort, err := s.portManager.CreatePortMapping(req.ContainerId, c.IPv4, req.ContainerPort, req.HostPort, req.Protocol)
	if err != nil {
		return &node.CreatePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.CreatePortMappingResponse{
		Success:   true,
		MappingId: mappingID,
		HostPort:  hostPort,
	}, nil
}

func (s *Server) GetPortMappings(ctx context.Context, req *node.GetPortMappingsRequest) (*node.GetPortMappingsResponse, error) {
	mappings := s.portManager.GetPortMappings(req.ContainerId)

	pbMappings := make([]*node.PortMapping, 0, len(mappings))
	for _, pm := range mappings {
		pbMappings = append(pbMappings, &node.PortMapping{
			Id:            pm.ID,
			HostPort:      pm.HostPort,
			ContainerPort: pm.ContainerPort,
			Protocol:      pm.Protocol,
		})
	}

	return &node.GetPortMappingsResponse{
		Success:  true,
		Mappings: pbMappings,
	}, nil
}

func (s *Server) UpdatePortMapping(ctx context.Context, req *node.UpdatePortMappingRequest) (*node.UpdatePortMappingResponse, error) {
	c, err := s.provider.GetContainer(req.ContainerId)
	if err != nil {
		return &node.UpdatePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	err = s.portManager.UpdatePortMapping(req.ContainerId, c.IPv4, req.MappingId, req.HostPort, req.ContainerPort)
	if err != nil {
		return &node.UpdatePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.UpdatePortMappingResponse{Success: true}, nil
}

func (s *Server) DeletePortMapping(ctx context.Context, req *node.DeletePortMappingRequest) (*node.DeletePortMappingResponse, error) {
	c, err := s.provider.GetContainer(req.ContainerId)
	if err != nil {
		return &node.DeletePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	err = s.portManager.DeletePortMapping(req.ContainerId, c.IPv4, req.MappingId)
	if err != nil {
		return &node.DeletePortMappingResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &node.DeletePortMappingResponse{Success: true}, nil
}

func (s *Server) StreamMetrics(req *node.MetricsRequest, stream node.NodeService_StreamMetricsServer) error {
	collector := metrics.NewCollector(s.provider.(*provider.LXD).GetClient())
	
	refreshMs := req.RefreshMs
	if refreshMs < 100 {
		refreshMs = 1000
	}
	
	ticker := time.NewTicker(time.Duration(refreshMs) * time.Millisecond)
	defer ticker.Stop()
	
	nodeID := "node-" + os.Getenv("NODE_ID")
	if nodeID == "node-" {
		nodeID = "node-default"
	}
	
	for {
		select {
		case <-ticker.C:
			nodeMetrics, err := collector.GetNodeMetrics(nodeID)
			if err != nil {
				continue
			}
			
			containerMetrics, err := collector.GetAllContainerMetrics()
			if err != nil {
				containerMetrics = []*node.ContainerMetrics{}
			}
			
			response := &node.MetricsResponse{
				Node:       nodeMetrics,
				Containers: containerMetrics,
				Timestamp:  time.Now().Unix(),
			}
			
			if err := stream.Send(response); err != nil {
				return err
			}
			
		case <-stream.Context().Done():
			return nil
		}
	}
}

func (s *Server) StreamContainerMetrics(req *node.ContainerMetricsRequest, stream node.NodeService_StreamContainerMetricsServer) error {
	collector := metrics.NewCollector(s.provider.(*provider.LXD).GetClient())
	
	refreshMs := req.RefreshMs
	if refreshMs < 100 {
		refreshMs = 1000
	}
	
	streamID := time.Now().Unix()
	slog.Info("starting container metrics stream", "stream_id", streamID, "container_id", req.ContainerId, "refresh_ms", refreshMs)
	
	ticker := time.NewTicker(time.Duration(refreshMs) * time.Millisecond)
	defer ticker.Stop()
	
	count := 0
	for {
		select {
		case <-ticker.C:
			count++
			containerMetrics, err := collector.GetContainerMetrics(req.ContainerId)
			if err != nil {
				slog.Error("failed to get container metrics", "stream_id", streamID, "err", err)
				continue
			}
			
			response := &node.ContainerMetricsResponse{
				Metrics:   containerMetrics,
				Timestamp: time.Now().Unix(),
			}
			
			if count <= 3 || count%10 == 0 {
				slog.Info("sending metrics", "stream_id", streamID, "count", count, "cpu", containerMetrics.CpuPercent, "ram", containerMetrics.RamPercent)
			}
			
			if err := stream.Send(response); err != nil {
				slog.Error("failed to send metrics", "stream_id", streamID, "err", err)
				return err
			}
			
		case <-stream.Context().Done():
			slog.Info("stream closed", "stream_id", streamID, "total_sent", count)
			return nil
		}
	}
}
