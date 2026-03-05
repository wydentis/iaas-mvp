package models

import "time"

type PublicIP struct {
	ID           string    `json:"id"`
	NodeID       string    `json:"node_id"`
	IPAddress    string    `json:"ip_address"`
	ContainerID  *string   `json:"container_id"`
	PriceMonthly float64   `json:"price_monthly"`
	CreatedAt    time.Time `json:"created_at"`
}
