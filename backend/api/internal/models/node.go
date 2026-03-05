package models

import "time"

type Node struct {
	ID         string    `json:"node_id"`
	Name       string    `json:"name"`
	IPAddress  string    `json:"ip_address"`
	Status     string    `json:"status"`
	CPUCores   int       `json:"cpu_cores"`
	RAM        int       `json:"ram"`
	DiskSpace  int       `json:"disk_space"`
	TotalVCPU  int       `json:"total_vcpu"`
	TotalRAM   int       `json:"total_ram_mb"`
	TotalDisk  int       `json:"total_disk_gb"`
	CPUPrice   float64   `json:"cpu_price"`
	RAMPrice   float64   `json:"ram_price"`
	DiskPrice  float64   `json:"disk_price"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// NodeWithResources extends Node with live resource usage and dynamic pricing.
type NodeWithResources struct {
	Node
	UsedCPU       int     `json:"used_cpu"`
	UsedRAM       int     `json:"used_ram_mb"`
	UsedDisk      int     `json:"used_disk_gb"`
	DynCPUPrice   float64 `json:"dyn_cpu_price"`
	DynRAMPrice   float64 `json:"dyn_ram_price"`
	DynDiskPrice  float64 `json:"dyn_disk_price"`
	PublicIPsFree int     `json:"public_ips_free"`
}

type CreateNodeRequest struct {
	Name       string  `json:"name"`
	IPAddress  string  `json:"ip_address"`
	Status     string  `json:"status"`
	CPUCores   int     `json:"cpu_cores"`
	RAM        int     `json:"ram"`
	DiskSpace  int     `json:"disk_space"`
	TotalVCPU  int     `json:"total_vcpu"`
	TotalRAM   int     `json:"total_ram_mb"`
	TotalDisk  int     `json:"total_disk_gb"`
	CPUPrice   float64 `json:"cpu_price"`
	RAMPrice   float64 `json:"ram_price"`
	DiskPrice  float64 `json:"disk_price"`
}

type UpdateNodeRequest struct {
	Name       string  `json:"name"`
	IPAddress  string  `json:"ip_address"`
	Status     string  `json:"status"`
	CPUCores   int     `json:"cpu_cores"`
	RAM        int     `json:"ram"`
	DiskSpace  int     `json:"disk_space"`
	TotalVCPU  int     `json:"total_vcpu"`
	TotalRAM   int     `json:"total_ram_mb"`
	TotalDisk  int     `json:"total_disk_gb"`
	CPUPrice   float64 `json:"cpu_price"`
	RAMPrice   float64 `json:"ram_price"`
	DiskPrice  float64 `json:"disk_price"`
}
