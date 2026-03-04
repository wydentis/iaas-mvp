package container

import (
	"github.com/canonical/lxd/shared/api"
)

type Container struct {
	ID       string
	Image    string
	Specs    Specs
	Instance api.Instance
	Status   ContainerStatus
	IPv4     string
}

type ContainerStatus string

const (
	ContainerStatusUnknown ContainerStatus = "UNKNOWN"
	ContainerStatusPending ContainerStatus = "PENDING"
	ContainerStatusRunning ContainerStatus = "RUNNING"
	ContainerStatusStopped ContainerStatus = "STOPPED"
	ContainerStatusError   ContainerStatus = "ERROR"
)

type Specs struct {
	RAM        int32
	CPUPercent int32
	Disk       int32
}
