package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type ServerConfig struct {
	Port      int            `json:"port"`
	JWTSecret string         `json:"jwt_secret"`
	DBConfig  DatabaseConfig `json:"db_config"`
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

	return &config, nil
}
