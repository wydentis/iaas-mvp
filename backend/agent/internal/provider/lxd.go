package provider

import (
	"fmt"
	"math"
	"net"
	"strings"
	"bytes"

	lxd "github.com/canonical/lxd/client"
	"github.com/canonical/lxd/shared/api"
	"github.com/wydentis/iaas-mvp/agent/internal/container"
)

type Provider interface {
	CreateContainer(name, image string, specs container.Specs, startScript string) (string, error)
	GetContainer(name string) (*container.Container, error)
	SetStatus(name string, status container.ContainerStatus) error
	DeleteContainer(name string) error
	UpdateSpecs(name string, specs container.Specs) error
	RunCommand(name string, command string) (string, error)
}

type LXD struct {
	client lxd.InstanceServer
}

func NewLXD(path string) (*LXD, error) {
	c, err := lxd.ConnectLXDUnix(path, nil)
	if err != nil {
		return nil, err
	}
	return &LXD{c}, err
}

func (l *LXD) GetClient() lxd.InstanceServer {
	return l.client
}

func (l *LXD) CreateContainer(name, image string, specs container.Specs, startScript string) (string, error) {
	visibleCores := int(math.Ceil(float64(specs.CPUPercent) / 100))

	// Get network config to determine subnet
	network, _, err := l.client.GetNetwork("lxdbr0")
	if err != nil {
		return "", err
	}

	cidr := network.Config["ipv4.address"]
	ip, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return "", err
	}

	// Basic assumption: /24 network
	ones, _ := ipNet.Mask.Size()
	if ones != 24 {
		return "", fmt.Errorf("only /24 networks supported")
	}

	baseIP := ip.To4()

	// Find used IPs
	instances, err := l.client.GetInstances(lxd.GetInstancesArgs{
		InstanceType: api.InstanceTypeContainer,
	})
	if err != nil {
		return "", err
	}

	usedIPs := make(map[string]bool)
	usedIPs[baseIP.String()] = true // Gateway

	for _, inst := range instances {
		// Check static assignment in config (even if stopped)
		// We need full instance info to get devices
		fullInst := inst
		if fullInst.ExpandedDevices == nil {
			fi, _, err := l.client.GetInstance(inst.Name)
			if err == nil {
				fullInst = *fi
			}
		}

		if fullInst.ExpandedDevices != nil {
			if eth0, ok := fullInst.ExpandedDevices["eth0"]; ok {
				if ip, ok := eth0["ipv4.address"]; ok {
					usedIPs[ip] = true
				}
			}
		}

		state, _, err := l.client.GetInstanceState(inst.Name)
		if err != nil {
			continue
		}
		if state.Network != nil {
			for _, net := range state.Network {
				for _, addr := range net.Addresses {
					if addr.Family == "inet" && addr.Scope == "global" {
						usedIPs[addr.Address] = true
					}
				}
			}
		}
	}

	var newIP string
	for i := 2; i < 255; i++ {
		candidate := fmt.Sprintf("%d.%d.%d.%d", baseIP[0], baseIP[1], baseIP[2], i)
		if !usedIPs[candidate] {
			newIP = candidate
			break
		}
	}

	if newIP == "" {
		return "", fmt.Errorf("no free IPs available")
	}

	req := api.InstancesPost{
		Name: name,
		Source: api.InstanceSource{
			Type:     "image",
			Server:   "https://images.lxd.canonical.com",
			Protocol: "simplestreams",
			Alias:    image,
		},
		Type: "container",
		InstancePut: api.InstancePut{
			Config: map[string]string{
				"security.nesting":     "true",
				"limits.memory":        fmt.Sprintf("%dMB", specs.RAM),
				"limits.cpu":           fmt.Sprintf("%d", visibleCores),
				"limits.cpu.allowance": fmt.Sprintf("%d%%", specs.CPUPercent),
			},
			Devices: map[string]map[string]string{
				"root": {
					"path": "/",
					"pool": "default",
					"type": "disk",
					"size": fmt.Sprintf("%dGB", specs.Disk),
				},
				"eth0": {
					"name":         "eth0",
					"network":      "lxdbr0",
					"type":         "nic",
					"ipv4.address": newIP,
				},
			},
		},
	}

	op, err := l.client.CreateInstance(req)
	if err != nil {
		return "", err
	}

	if err := op.Wait(); err != nil {
		return "", err
	}

	// Start the container
	reqState := api.InstanceStatePut{
		Action:  "start",
		Timeout: -1,
	}

	op, err = l.client.UpdateInstanceState(name, reqState, "")
	if err != nil {
		return "", err
	}

	if err := op.Wait(); err != nil {
		return "", err
	}

	// Fix DNS for systemd-resolved based systems (Debian/Ubuntu)
	// systemd-resolved uses 127.0.0.53 which doesn't work in containers without systemd
	// We need to remove the symlink and create a real file
	dnsFixScript := `
rm -f /etc/resolv.conf
cat > /etc/resolv.conf << 'EOFDNS'
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1
EOFDNS
chmod 644 /etc/resolv.conf
`
	
	reqExec := api.InstanceExecPost{
		Command:   []string{"/bin/sh", "-c", dnsFixScript},
		WaitForWS: true,
	}

	stdout := &writeCloser{&bytes.Buffer{}}
	stderr := &writeCloser{&bytes.Buffer{}}

	args := lxd.InstanceExecArgs{
		Stdout: stdout,
		Stderr: stderr,
	}

	op, err = l.client.ExecInstance(name, reqExec, &args)
	if err == nil {
		op.Wait() // Ignore errors - not critical
	}

	// Execute start script if provided
	if startScript != "" {
		// Write script to file
		err = l.client.CreateInstanceFile(name, "/root/startup.sh", lxd.InstanceFileArgs{
			Content:   strings.NewReader(startScript),
			UID:       0,
			GID:       0,
			Mode:      0755,
			Type:      "file",
			WriteMode: "overwrite",
		})
		if err != nil {
			return "", fmt.Errorf("failed to create startup script: %w", err)
		}

		// Execute script
		reqExec := api.InstanceExecPost{
			Command:   []string{"/bin/sh", "/root/startup.sh"},
			WaitForWS: true,
		}

		stdout := &writeCloser{&bytes.Buffer{}}
		stderr := &writeCloser{&bytes.Buffer{}}

		args := lxd.InstanceExecArgs{
			Stdout: stdout,
			Stderr: stderr,
		}

		op, err := l.client.ExecInstance(name, reqExec, &args)
		if err != nil {
			return "", fmt.Errorf("failed to execute startup script: %w", err)
		}

		if err := op.Wait(); err != nil {
			return "", fmt.Errorf("failed to wait for startup script: %w", err)
		}
	}

	return newIP, nil
}

type writeCloser struct {
	*bytes.Buffer
}

func (wc *writeCloser) Close() error {
	return nil
}

func (l *LXD) RunCommand(name string, command string) (string, error) {
	reqExec := api.InstanceExecPost{
		Command:   []string{"/bin/sh", "-c", command},
		WaitForWS: true,
	}

	stdout := &writeCloser{&bytes.Buffer{}}
	stderr := &writeCloser{&bytes.Buffer{}}

	args := lxd.InstanceExecArgs{
		Stdout: stdout,
		Stderr: stderr,
	}

	op, err := l.client.ExecInstance(name, reqExec, &args)
	if err != nil {
		return "", err
	}

	if err := op.Wait(); err != nil {
		return "", err
	}

	if stderr.Len() > 0 {
		return stdout.String() + "\nError: " + stderr.String(), nil
	}

	return stdout.String(), nil
}

func (l *LXD) GetContainer(name string) (*container.Container, error) {
	inst, _, err := l.client.GetInstance(name)
	if err != nil {
		return nil, err
	}

	state, _, err := l.client.GetInstanceState(name)
	if err != nil {
		return nil, err
	}

	var ipv4 string
	if state != nil && state.Network != nil {
		// First try to find IP from network state (works for DHCP/dynamic)
		for _, net := range state.Network {
			for _, addr := range net.Addresses {
				if addr.Family == "inet" && addr.Scope == "global" {
					ipv4 = addr.Address
					break
				}
			}
			if ipv4 != "" {
				break
			}
		}
	}

	// Fallback: if no IP found in state, check expanded devices for static assignment
	if ipv4 == "" {
		expanded := inst.ExpandedDevices
		if eth0, ok := expanded["eth0"]; ok {
			if ip, ok := eth0["ipv4.address"]; ok {
				ipv4 = ip
			}
		}
	}

	var status container.ContainerStatus
	switch inst.Status {
	case "Running":
		status = container.ContainerStatusRunning
	case "Stopped":
		status = container.ContainerStatusStopped
	default:
		status = container.ContainerStatusUnknown
	}

	return &container.Container{
		ID:       name,
		Status:   status,
		IPv4:     ipv4,
		Instance: *inst,
	}, nil
}

func (l *LXD) SetStatus(name string, status container.ContainerStatus) error {
	req := api.InstanceStatePut{
		Action:  "start",
		Timeout: -1,
	}

	if status == container.ContainerStatusStopped {
		req.Action = "stop"
		req.Force = true
	} else if status == container.ContainerStatusRunning {
		req.Action = "start"
	} else {
		return fmt.Errorf("invalid status")
	}

	op, err := l.client.UpdateInstanceState(name, req, "")
	if err != nil {
		return err
	}

	return op.Wait()
}

func (l *LXD) DeleteContainer(name string) error {
	// Ensure the container is stopped before deleting
	req := api.InstanceStatePut{
		Action:  "stop",
		Timeout: -1,
		Force:   true,
	}

	op, err := l.client.UpdateInstanceState(name, req, "")
	if err == nil {
		op.Wait()
	}

	op, err = l.client.DeleteInstance(name, true)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil
		}
		return err
	}

	return op.Wait()
}

func (l *LXD) UpdateSpecs(name string, specs container.Specs) error {
	req, etag, err := l.client.GetInstance(name)
	if err != nil {
		return err
	}

	reqPut := req.Writable()

	visibleCores := int(math.Ceil(float64(specs.CPUPercent) / 100))

	reqPut.Config["limits.memory"] = fmt.Sprintf("%dMB", specs.RAM)
	reqPut.Config["limits.cpu"] = fmt.Sprintf("%d", visibleCores)
	reqPut.Config["limits.cpu.allowance"] = fmt.Sprintf("%d%%", specs.CPUPercent)

	// Note: Resizing disk usually requires different handling depending on storage driver
	// For simplicity, we are only updating limits here. Disk resize on LXD often involves
	// resizing the root device in the 'devices' map.

	if reqPut.Devices["root"] != nil {
		reqPut.Devices["root"]["size"] = fmt.Sprintf("%dGB", specs.Disk)
	}

	op, err := l.client.UpdateInstance(name, reqPut, etag)
	if err != nil {
		return err
	}

	return op.Wait()
}
