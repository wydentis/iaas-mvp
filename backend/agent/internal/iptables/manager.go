package iptables

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

type PortMapping struct {
	ID            string
	ContainerID   string
	ContainerIP   string
	HostPort      int32
	ContainerPort int32
	Protocol      string
}

type Manager struct {
	mu            sync.RWMutex
	mappings      map[string]*PortMapping // key: mapping ID
	autoSaveRules bool
}

func NewManager() (*Manager, error) {
	// Verify iptables is available
	if err := exec.Command("iptables", "--version").Run(); err != nil {
		return nil, fmt.Errorf("iptables not available: %w", err)
	}

	// Enable IP forwarding
	exec.Command("sh", "-c", "echo 1 > /proc/sys/net/ipv4/ip_forward").Run()

	// Check if iptables-persistent is available
	autoSave := false
	if _, err := exec.Command("which", "iptables-save").CombinedOutput(); err == nil {
		if _, err := exec.Command("test", "-d", "/etc/iptables").CombinedOutput(); err == nil {
			autoSave = true
		}
	}

	return &Manager{
		mappings:      make(map[string]*PortMapping),
		autoSaveRules: autoSave,
	}, nil
}

func (m *Manager) saveRules() {
	if !m.autoSaveRules {
		return
	}
	exec.Command("sh", "-c", "iptables-save > /etc/iptables/rules.v4 2>/dev/null").Run()
}

// CreatePortMapping creates an iptables NAT rule for port forwarding
func (m *Manager) CreatePortMapping(containerID, containerIP string, containerPort, hostPort int32, protocol string) (string, int32, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if protocol == "" {
		protocol = "tcp"
	}

	// Find available host port if not specified
	if hostPort == 0 {
		var err error
		hostPort, err = m.findAvailablePort()
		if err != nil {
			return "", 0, err
		}
	}

	// Generate mapping ID
	mappingID := fmt.Sprintf("%s-%d-%d", containerID, hostPort, containerPort)

	// Add PREROUTING rule for DNAT
	preRoutingCmd := fmt.Sprintf(
		"iptables -t nat -A PREROUTING -p %s --dport %d -j DNAT --to-destination %s:%d",
		protocol, hostPort, containerIP, containerPort,
	)
	if err := exec.Command("sh", "-c", preRoutingCmd).Run(); err != nil {
		return "", 0, fmt.Errorf("failed to add PREROUTING rule: %w", err)
	}

	// Add FORWARD rule to allow forwarded traffic
	forwardCmd := fmt.Sprintf(
		"iptables -A FORWARD -p %s -d %s --dport %d -j ACCEPT",
		protocol, containerIP, containerPort,
	)
	if err := exec.Command("sh", "-c", forwardCmd).Run(); err != nil {
		// Cleanup PREROUTING rule
		m.deletePreRoutingRule(protocol, hostPort, containerIP, containerPort)
		return "", 0, fmt.Errorf("failed to add FORWARD rule: %w", err)
	}

	// Add OUTPUT rule for localhost connections
	outputCmd := fmt.Sprintf(
		"iptables -t nat -A OUTPUT -p %s --dport %d -j DNAT --to-destination %s:%d",
		protocol, hostPort, containerIP, containerPort,
	)
	exec.Command("sh", "-c", outputCmd).Run()

	// Add POSTROUTING rule for masquerade if not exists
	exec.Command("sh", "-c", "iptables -t nat -C POSTROUTING -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -j MASQUERADE").Run()

	// Save mapping
	m.mappings[mappingID] = &PortMapping{
		ID:            mappingID,
		ContainerID:   containerID,
		ContainerIP:   containerIP,
		HostPort:      hostPort,
		ContainerPort: containerPort,
		Protocol:      protocol,
	}

	// Auto-save rules if iptables-persistent is available
	m.saveRules()

	return mappingID, hostPort, nil
}

// GetPortMappings returns all port mappings for a container
func (m *Manager) GetPortMappings(containerID string) []*PortMapping {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*PortMapping
	for _, pm := range m.mappings {
		if pm.ContainerID == containerID {
			result = append(result, pm)
		}
	}
	return result
}

// UpdatePortMapping updates an existing port mapping
func (m *Manager) UpdatePortMapping(containerID, containerIP, mappingID string, hostPort, containerPort int32) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	pm, exists := m.mappings[mappingID]
	if !exists {
		return fmt.Errorf("mapping not found: %s", mappingID)
	}

	// Delete old rules
	m.deletePreRoutingRule(pm.Protocol, pm.HostPort, pm.ContainerIP, pm.ContainerPort)
	m.deleteForwardRule(pm.Protocol, pm.ContainerIP, pm.ContainerPort)

	// Add new rules
	preRoutingCmd := fmt.Sprintf(
		"iptables -t nat -A PREROUTING -p %s --dport %d -j DNAT --to-destination %s:%d",
		pm.Protocol, hostPort, containerIP, containerPort,
	)
	if err := exec.Command("sh", "-c", preRoutingCmd).Run(); err != nil {
		return fmt.Errorf("failed to add PREROUTING rule: %w", err)
	}

	forwardCmd := fmt.Sprintf(
		"iptables -A FORWARD -p %s -d %s --dport %d -j ACCEPT",
		pm.Protocol, containerIP, containerPort,
	)
	if err := exec.Command("sh", "-c", forwardCmd).Run(); err != nil {
		m.deletePreRoutingRule(pm.Protocol, hostPort, containerIP, containerPort)
		return fmt.Errorf("failed to add FORWARD rule: %w", err)
	}

	// Update mapping
	pm.HostPort = hostPort
	pm.ContainerPort = containerPort
	pm.ContainerIP = containerIP

	// Auto-save rules
	m.saveRules()

	return nil
}

// DeletePortMapping removes a port mapping
func (m *Manager) DeletePortMapping(containerID, containerIP, mappingID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	pm, exists := m.mappings[mappingID]
	if !exists {
		return fmt.Errorf("mapping not found: %s", mappingID)
	}

	// Delete iptables rules
	m.deletePreRoutingRule(pm.Protocol, pm.HostPort, pm.ContainerIP, pm.ContainerPort)
	m.deleteForwardRule(pm.Protocol, pm.ContainerIP, pm.ContainerPort)

	delete(m.mappings, mappingID)
	
	// Auto-save rules
	m.saveRules()
	
	return nil
}

// CleanupContainer removes all port mappings for a container
func (m *Manager) CleanupContainer(containerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, pm := range m.mappings {
		if pm.ContainerID == containerID {
			m.deletePreRoutingRule(pm.Protocol, pm.HostPort, pm.ContainerIP, pm.ContainerPort)
			m.deleteForwardRule(pm.Protocol, pm.ContainerIP, pm.ContainerPort)
			delete(m.mappings, id)
		}
	}

	// Auto-save rules
	m.saveRules()

	return nil
}

func (m *Manager) deletePreRoutingRule(protocol string, hostPort int32, containerIP string, containerPort int32) {
	cmd := fmt.Sprintf(
		"iptables -t nat -D PREROUTING -p %s --dport %d -j DNAT --to-destination %s:%d 2>/dev/null",
		protocol, hostPort, containerIP, containerPort,
	)
	exec.Command("sh", "-c", cmd).Run()
	
	// Also delete OUTPUT rule
	outputCmd := fmt.Sprintf(
		"iptables -t nat -D OUTPUT -p %s --dport %d -j DNAT --to-destination %s:%d 2>/dev/null",
		protocol, hostPort, containerIP, containerPort,
	)
	exec.Command("sh", "-c", outputCmd).Run()
}

func (m *Manager) deleteForwardRule(protocol string, containerIP string, containerPort int32) {
	cmd := fmt.Sprintf(
		"iptables -D FORWARD -p %s -d %s --dport %d -j ACCEPT 2>/dev/null",
		protocol, containerIP, containerPort,
	)
	exec.Command("sh", "-c", cmd).Run()
}

func (m *Manager) findAvailablePort() (int32, error) {
	usedPorts := make(map[int32]bool)
	for _, pm := range m.mappings {
		usedPorts[pm.HostPort] = true
	}

	// Check ports from 10000 to 60000
	for port := int32(10000); port < 60000; port++ {
		if !usedPorts[port] && !m.isPortInUse(port) {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available ports")
}

func (m *Manager) isPortInUse(port int32) bool {
	// Check if port is already in iptables rules
	cmd := exec.Command("sh", "-c", fmt.Sprintf("iptables -t nat -L PREROUTING -n | grep 'dpt:%d'", port))
	output, _ := cmd.Output()
	return len(output) > 0
}

// LoadExistingMappings scans iptables and loads existing mappings
func (m *Manager) LoadExistingMappings() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := exec.Command("sh", "-c", "iptables -t nat -L PREROUTING -n --line-numbers")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to list iptables rules: %w", err)
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if !strings.Contains(line, "DNAT") {
			continue
		}

		// Parse iptables output: proto dpt:hostPort to:containerIP:containerPort
		fields := strings.Fields(line)
		if len(fields) < 7 {
			continue
		}

		protocol := strings.ToLower(fields[2])
		
		// Extract host port from "dpt:10000"
		var hostPort int32
		for _, field := range fields {
			if strings.HasPrefix(field, "dpt:") {
				if p, err := strconv.Atoi(strings.TrimPrefix(field, "dpt:")); err == nil {
					hostPort = int32(p)
				}
			}
		}

		// Extract container IP and port from "to:10.x.x.x:22"
		var containerIP string
		var containerPort int32
		for _, field := range fields {
			if strings.HasPrefix(field, "to:") {
				parts := strings.SplitN(strings.TrimPrefix(field, "to:"), ":", 2)
				if len(parts) == 2 {
					containerIP = parts[0]
					if p, err := strconv.Atoi(parts[1]); err == nil {
						containerPort = int32(p)
					}
				}
			}
		}

		if hostPort > 0 && containerPort > 0 && containerIP != "" {
			mappingID := fmt.Sprintf("existing-%d-%d", hostPort, containerPort)
			m.mappings[mappingID] = &PortMapping{
				ID:            mappingID,
				ContainerIP:   containerIP,
				HostPort:      hostPort,
				ContainerPort: containerPort,
				Protocol:      protocol,
			}
		}
	}

	return nil
}
