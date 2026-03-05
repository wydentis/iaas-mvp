package models

import "time"

type Snapshot struct {
	ID          string    `json:"snapshot_id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Image       string    `json:"image"`
	CPU         int32     `json:"cpu"`
	RAM         int32     `json:"ram"`
	Disk        int32     `json:"disk"`
	StartScript string    `json:"start_script"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateSnapshotRequest struct {
	ContainerID string `json:"container_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    bool   `json:"is_public"`
}
