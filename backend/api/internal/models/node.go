package models

import "time"

type Node struct {
	ID        string    `json:"node_id"`
	Name      string    `json:"name"`
	IPAddress string    `json:"ip_address"`
	Status    string    `json:"status"`
	CPUCores  int       `json:"cpu_cores"`
	RAM       int       `json:"ram"`
	DiskSpace int       `json:"disk_space"`
	CPUPrice  float64   `json:"cpu_price"`
	RAMPrice  float64   `json:"ram_price"`
	DiskPrice float64   `json:"disk_price"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateNodeRequest struct {
	Name      string  `json:"name"`
	IPAddress string  `json:"ip_address"`
	Status    string  `json:"status"`
	CPUCores  int     `json:"cpu_cores"`
	RAM       int     `json:"ram"`
	DiskSpace int     `json:"disk_space"`
	CPUPrice  float64 `json:"cpu_price"`
	RAMPrice  float64 `json:"ram_price"`
	DiskPrice float64 `json:"disk_price"`
}

type UpdateNodeRequest struct {
	Name      string  `json:"name"`
	IPAddress string  `json:"ip_address"`
	Status    string  `json:"status"`
	CPUCores  int     `json:"cpu_cores"`
	RAM       int     `json:"ram"`
	DiskSpace int     `json:"disk_space"`
	CPUPrice  float64 `json:"cpu_price"`
	RAMPrice  float64 `json:"ram_price"`
	DiskPrice float64 `json:"disk_price"`
}
