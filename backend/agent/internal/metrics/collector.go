package metrics

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	lxd "github.com/canonical/lxd/client"
	"github.com/canonical/lxd/shared/api"
	node "github.com/wydentis/iaas-mvp/backend/proto"
)

type Collector struct {
	lxdClient    lxd.InstanceServer
	prevCPUStats map[string]*CPUStats
	prevTime     time.Time
}

type CPUStats struct {
	Usage     int64
	Timestamp time.Time
}

func NewCollector(client lxd.InstanceServer) *Collector {
	return &Collector{
		lxdClient:    client,
		prevCPUStats: make(map[string]*CPUStats),
		prevTime:     time.Now(),
	}
}

func (c *Collector) GetNodeMetrics(nodeID string) (*node.NodeMetrics, error) {
	cpuPercent, err := c.getNodeCPUPercent()
	if err != nil {
		cpuPercent = 0
	}

	ramPercent, err := c.getNodeRAMPercent()
	if err != nil {
		ramPercent = 0
	}

	diskPercent, err := c.getNodeDiskPercent()
	if err != nil {
		diskPercent = 0
	}

	rxBytes, txBytes, err := c.getNodeNetworkBytes()
	if err != nil {
		rxBytes, txBytes = 0, 0
	}

	return &node.NodeMetrics{
		NodeId:          nodeID,
		CpuPercent:      float32(cpuPercent),
		RamPercent:      float32(ramPercent),
		DiskPercent:     float32(diskPercent),
		NetworkRxBytes:  rxBytes,
		NetworkTxBytes:  txBytes,
	}, nil
}

func (c *Collector) GetAllContainerMetrics() ([]*node.ContainerMetrics, error) {
	instances, err := c.lxdClient.GetInstancesFull(lxd.GetInstancesFullArgs{})
	if err != nil {
		return nil, err
	}

	var metrics []*node.ContainerMetrics
	for _, inst := range instances {
		if inst.Type != "container" {
			continue
		}

		containerMetrics, err := c.GetContainerMetrics(inst.Name)
		if err != nil {
			continue
		}
		metrics = append(metrics, containerMetrics)
	}

	return metrics, nil
}

func (c *Collector) GetContainerMetrics(containerID string) (*node.ContainerMetrics, error) {
	state, _, err := c.lxdClient.GetInstanceState(containerID)
	if err != nil {
		return nil, err
	}

	inst, _, err := c.lxdClient.GetInstance(containerID)
	if err != nil {
		return nil, err
	}

	cpuPercent := c.calculateContainerCPUPercent(containerID, state, inst)
	ramPercent := c.calculateContainerRAMPercent(state, inst)
	diskUsage := c.calculateContainerDiskUsage(state)
	rxBytes, txBytes := c.calculateContainerNetwork(state)

	return &node.ContainerMetrics{
		ContainerId:      containerID,
		CpuPercent:       float32(cpuPercent),
		RamPercent:       float32(ramPercent),
		DiskUsageBytes:   diskUsage,
		NetworkRxBytes:   rxBytes,
		NetworkTxBytes:   txBytes,
	}, nil
}

func (c *Collector) getNodeCPUPercent() (float64, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return 0, fmt.Errorf("failed to read /proc/stat")
	}

	line := scanner.Text()
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, fmt.Errorf("invalid /proc/stat format")
	}

	var totalIdle, totalUsed uint64
	for i := 1; i < len(fields); i++ {
		val, _ := strconv.ParseUint(fields[i], 10, 64)
		if i == 4 {
			totalIdle = val
		}
		totalUsed += val
	}

	total := totalUsed
	idle := totalIdle
	used := total - idle

	if total == 0 {
		return 0, nil
	}

	return float64(used) / float64(total) * 100, nil
}

func (c *Collector) getNodeRAMPercent() (float64, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	defer file.Close()

	var memTotal, memFree, buffers, cached uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}

		value, _ := strconv.ParseUint(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:":
			memTotal = value
		case "MemFree:":
			memFree = value
		case "Buffers:":
			buffers = value
		case "Cached:":
			cached = value
		}
	}

	if memTotal == 0 {
		return 0, nil
	}

	used := memTotal - memFree - buffers - cached
	return float64(used) / float64(memTotal) * 100, nil
}

func (c *Collector) getNodeDiskPercent() (float64, error) {
	pools, err := c.lxdClient.GetStoragePoolNames()
	if err != nil {
		return 0, err
	}

	if len(pools) == 0 {
		return 0, nil
	}

	poolResources, err := c.lxdClient.GetStoragePoolResources(pools[0])
	if err != nil {
		return 0, err
	}

	if poolResources.Space.Total == 0 {
		return 0, nil
	}

	used := poolResources.Space.Used
	total := poolResources.Space.Total

	return float64(used) / float64(total) * 100, nil
}

func (c *Collector) getNodeNetworkBytes() (int64, int64, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	var totalRx, totalTx int64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.Contains(line, ":") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 10 {
			continue
		}

		iface := strings.TrimSuffix(fields[0], ":")
		if iface == "lo" {
			continue
		}

		rx, _ := strconv.ParseInt(fields[1], 10, 64)
		tx, _ := strconv.ParseInt(fields[9], 10, 64)

		totalRx += rx
		totalTx += tx
	}

	return totalRx, totalTx, nil
}

func (c *Collector) calculateContainerCPUPercent(containerID string, state *api.InstanceState, inst *api.Instance) float64 {
	if state.CPU.Usage == 0 {
		return 0
	}

	now := time.Now()
	currentUsage := state.CPU.Usage

	prev, exists := c.prevCPUStats[containerID]
	if !exists {
		// First measurement - store and return 0
		c.prevCPUStats[containerID] = &CPUStats{
			Usage:     currentUsage,
			Timestamp: now,
		}
		return 0
	}

	timeDelta := now.Sub(prev.Timestamp).Seconds()
	
	// Need at least some time difference to calculate
	if timeDelta < 0.1 {
		return 0
	}

	usageDelta := float64(currentUsage - prev.Usage)

	// Get CPU cores/limit
	numCores := 1.0
	if limitStr, ok := inst.Config["limits.cpu"]; ok {
		if cores, err := strconv.ParseFloat(limitStr, 64); err == nil {
			numCores = cores
		}
	}

	// Update previous stats
	c.prevCPUStats[containerID] = &CPUStats{
		Usage:     currentUsage,
		Timestamp: now,
	}

	// If no CPU was used in this interval, return 0
	if usageDelta <= 0 {
		return 0
	}

	// Calculate percentage
	// usageDelta is in nanoseconds
	// timeDelta is in seconds
	// numCores is the CPU limit
	cpuPercent := (usageDelta / (timeDelta * numCores * 1e9)) * 100

	if cpuPercent > 100 {
		cpuPercent = 100
	}
	
	if cpuPercent < 0 {
		cpuPercent = 0
	}

	return cpuPercent
}

func (c *Collector) calculateContainerRAMPercent(state *api.InstanceState, inst *api.Instance) float64 {
	if state.Memory.Usage == 0 {
		return 0
	}

	limitStr, ok := inst.Config["limits.memory"]
	if !ok {
		return 0
	}

	var limitBytes int64
	if strings.HasSuffix(limitStr, "MB") {
		mb, _ := strconv.ParseInt(strings.TrimSuffix(limitStr, "MB"), 10, 64)
		limitBytes = mb * 1024 * 1024
	} else if strings.HasSuffix(limitStr, "GB") {
		gb, _ := strconv.ParseInt(strings.TrimSuffix(limitStr, "GB"), 10, 64)
		limitBytes = gb * 1024 * 1024 * 1024
	}

	if limitBytes == 0 {
		return 0
	}

	return float64(state.Memory.Usage) / float64(limitBytes) * 100
}

func (c *Collector) calculateContainerDiskUsage(state *api.InstanceState) int64 {
	if state.Disk == nil {
		return 0
	}

	if rootDisk, ok := state.Disk["root"]; ok {
		return int64(rootDisk.Usage)
	}

	return 0
}

func (c *Collector) calculateContainerNetwork(state *api.InstanceState) (int64, int64) {
	if state.Network == nil {
		return 0, 0
	}

	var totalRx, totalTx int64
	for _, netInfo := range state.Network {
		totalRx += int64(netInfo.Counters.BytesReceived)
		totalTx += int64(netInfo.Counters.BytesSent)
	}

	return totalRx, totalTx
}
