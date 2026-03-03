package models

import "time"

type PortMapping struct {
	ID          string    `json:"id"`
	ContainerID string    `json:"container_id"`
	HostPort    int32     `json:"host_port"`
	ContainerPort int32   `json:"container_port"`
	Protocol    string    `json:"protocol"` // tcp or udp
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreatePortMappingRequest struct {
	ContainerPort int32  `json:"container_port"`
	HostPort      int32  `json:"host_port,omitempty"` // optional, auto-assign if not provided
	Protocol      string `json:"protocol"`
}

type UpdatePortMappingRequest struct {
	HostPort      int32  `json:"host_port"`
	ContainerPort int32  `json:"container_port"`
}
