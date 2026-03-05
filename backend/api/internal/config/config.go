package config

// add config var, what accessible from code and static

import (
	"encoding/json"
	"fmt"
	"os"
)

type ServerConfig struct {
	Port        int            `json:"port"`
	JWTSecret   string         `json:"jwt_secret"`
	DBConfig    DatabaseConfig `json:"db_config"`
	RabbitMQURL string         `json:"rabbitmq_url"`
	DevNode     DevNodeConfig  `json:"dev_node"`
}

// DevNodeConfig controls the in-process mock LXD node for development/testing.
// Set dev_node.enabled=true (or DEV_NODE_ENABLED=true env var) to activate.
// Remove or set to false before deploying to production.
type DevNodeConfig struct {
	Enabled bool   `json:"enabled"`
	Addr    string `json:"addr"`   // gRPC listen address, e.g. "localhost:50051"
	Name    string `json:"name"`   // node name shown in admin panel
	CPU     int    `json:"cpu"`    // total CPU cores
	RAM     int    `json:"ram"`    // total RAM in MB
	Disk    int    `json:"disk"`   // total disk in GB
}

type DatabaseConfig struct {
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"db_name"`
	DBHost   string `json:"db_host"`
}

func (cfg *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable", cfg.User, cfg.Password, cfg.DBHost, cfg.DBName)
}

func Load() (*ServerConfig, error) {
	return LoadFromFile("config.json")
}

func LoadFromFile(filename string) (*ServerConfig, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	expanded := os.ExpandEnv(string(data))

	var config ServerConfig
	if err := json.Unmarshal([]byte(expanded), &config); err != nil {
		return nil, err
	}

	// Allow enabling dev node via environment variable (config.json defaults to false)
	if os.Getenv("DEV_NODE_ENABLED") == "true" {
		config.DevNode.Enabled = true
	}
	// Default dev node address if not set
	if config.DevNode.Addr == "" {
		config.DevNode.Addr = "localhost:50051"
	}

	return &config, nil
}
