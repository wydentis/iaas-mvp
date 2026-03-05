package devnode

import (
	"context"
	"errors"
	"log/slog"

	"github.com/wydentis/iaas-mvp/api/internal/config"
	"github.com/wydentis/iaas-mvp/api/internal/models"
	"github.com/wydentis/iaas-mvp/api/internal/repo"
)

const devNodeName = "dev-node"

// EnsureDevNode upserts the dev node record in the database so it appears
// in the node list and can accept container workloads. The actual gRPC address
// (addr) may differ from cfg.Addr when port 0 was used.
func EnsureDevNode(ctx context.Context, nodeRepo *repo.NodeRepository, cfg config.DevNodeConfig, addr string) error {
	nodes, err := nodeRepo.ListNodes(ctx)
	if err != nil {
		return err
	}

	// Check if a dev node already exists
	for _, n := range nodes {
		if n.Name == devNodeName {
			// Update address in case it changed
			n.IPAddress = addr
			if updateErr := nodeRepo.UpdateNode(ctx, n); updateErr != nil {
				slog.Warn("devnode: failed to update dev node address", "err", updateErr)
			}
			slog.Info("devnode: found existing dev node", "id", n.ID, "addr", addr)
			return nil
		}
	}

	// Create fresh dev node
	cpu := cfg.CPU
	if cpu == 0 {
		cpu = 16
	}
	ram := cfg.RAM
	if ram == 0 {
		ram = 32768
	}
	disk := cfg.Disk
	if disk == 0 {
		disk = 500
	}

	node := &models.Node{
		Name:      devNodeName,
		IPAddress: addr,
		Status:    "active",
		CPUCores:  cpu,
		RAM:       ram,
		DiskSpace: disk,
		CPUPrice:  14.0,
		RAMPrice:  9.0,
		DiskPrice: 0.6,
	}

	if err := nodeRepo.CreateNode(ctx, node); err != nil {
		if !errors.Is(err, repo.ErrNodeAlreadyExists) {
			return err
		}
	}
	slog.Info("devnode: created dev node in DB", "id", node.ID, "addr", addr)
	return nil
}
