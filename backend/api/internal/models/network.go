package models

import "time"

type Network struct {
	ID          string    `json:"network_id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	Subnet      string    `json:"subnet"`
	Gateway     string    `json:"gateway"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type NetworkAttachment struct {
	ID          string    `json:"id"`
	NetworkID   string    `json:"network_id"`
	ContainerID string    `json:"container_id"`
	IPAddress   string    `json:"ip_address"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateNetworkRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Subnet      *string `json:"subnet,omitempty"`
	IsPublic    bool    `json:"is_public"`
}

type UpdateNetworkRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	IsPublic    *bool   `json:"is_public,omitempty"`
}

type AttachContainerRequest struct {
	ContainerID string  `json:"container_id"`
	IPAddress   *string `json:"ip_address,omitempty"`
}
