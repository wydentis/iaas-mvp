package models

import "time"

type Container struct {
	ID        string    `json:"container_id"`
	NodeID    string    `json:"node_id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Image     string    `json:"image"`
	CPU       int32     `json:"cpu"`  // CPU limit or cores
	RAM       int32     `json:"ram"`  // in MB
	Disk      int32     `json:"disk"` // in GB
	Status    ContainerStatus    `json:"status"`
	IPAddress string             `json:"ip_address"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ContainerStatus string

const (
	ContainerStatusUnknown ContainerStatus = "UNKNOWN"
	ContainerStatusPending ContainerStatus = "PENDING"
	ContainerStatusRunning ContainerStatus = "RUNNING"
	ContainerStatusStopped ContainerStatus = "STOPPED"
	ContainerStatusError   ContainerStatus = "ERROR"
)

type CreateContainerRequest struct {
	Name   string `json:"name"`
	NodeID string `json:"node_id"`
	Image  string `json:"image"`
	CPU    int32  `json:"cpu"`
	RAM    int32  `json:"ram"`
	Disk   int32  `json:"disk"`
	StartScript string `json:"start_script"`
}
