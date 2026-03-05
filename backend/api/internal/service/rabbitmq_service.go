package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/google/uuid"
)

type RabbitMQService struct {
	conn *amqp.Connection
}

func NewRabbitMQService(url string) (*RabbitMQService, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	return &RabbitMQService{conn: conn}, nil
}

func (s *RabbitMQService) Close() error {
	if s.conn != nil {
		return s.conn.Close()
	}
	return nil
}

// RPC call to any queue with timeout
func (s *RabbitMQService) CallRPC(ctx context.Context, queueName string, request interface{}, timeout time.Duration) ([]byte, error) {
	// Create a dedicated channel per call to avoid concurrent channel access
	ch, err := s.conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}
	defer ch.Close()

	// Create temporary exclusive queue for replies
	q, err := ch.QueueDeclare(
		"",    // name (empty = random)
		false, // durable
		true,  // auto-delete
		true,  // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare reply queue: %w", err)
	}

	// Start consuming from reply queue
	msgs, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		true,   // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register consumer: %w", err)
	}

	// Generate unique correlation ID
	corrID := uuid.New().String()

	// Marshal request to JSON
	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Publish request
	err = ch.PublishWithContext(
		ctx,
		"",        // exchange
		queueName, // routing key
		false,     // mandatory
		false,     // immediate
		amqp.Publishing{
			ContentType:   "application/json",
			CorrelationId: corrID,
			ReplyTo:       q.Name,
			Body:          body,
			DeliveryMode:  amqp.Persistent,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to publish message: %w", err)
	}

	slog.Info("RPC request sent", "queue", queueName, "correlationId", corrID)

	// Wait for response
	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("request timeout after %v", timeout)
		case msg, ok := <-msgs:
			if !ok {
				return nil, fmt.Errorf("reply channel closed")
			}
			if msg.CorrelationId == corrID {
				slog.Info("RPC response received", "correlationId", corrID)
				return msg.Body, nil
			}
		}
	}
}

// Hardware recommendation models
type HardwareRequest struct {
	Text string `json:"text"`
}

type ServerConfig struct {
	CPUCores   int    `json:"cpu_cores"`
	RAMGB      int    `json:"ram_gb"`
	DiskSizeGB int    `json:"disk_size_gb"`
	Reasoning  string `json:"reasoning"`
}

type HardwareResponse struct {
	BasicMinimum  ServerConfig `json:"basic_minimum"`
	Optimal       ServerConfig `json:"optimal"`
	LuxuryMaximum ServerConfig `json:"luxury_maximum"`
}

// Chat models
type ChatRequest struct {
	UserID  string `json:"user_id"`
	Message string `json:"message"`
}

type ChatResponse struct {
	UserID   string `json:"user_id"`
	Response string `json:"response,omitempty"`
	Status   string `json:"status"`
	Code     int    `json:"code,omitempty"`
	Message  string `json:"message,omitempty"`
}

// Get hardware recommendations
func (s *RabbitMQService) GetHardwareRecommendation(ctx context.Context, text string) (*HardwareResponse, error) {
	req := HardwareRequest{Text: text}
	
	respBody, err := s.CallRPC(ctx, "hardware_requests", req, 60*time.Second)
	if err != nil {
		return nil, err
	}

	var response HardwareResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal hardware response: %w", err)
	}

	return &response, nil
}

// Get chat response
func (s *RabbitMQService) GetChatResponse(ctx context.Context, userID, message string) (*ChatResponse, error) {
	req := ChatRequest{
		UserID:  userID,
		Message: message,
	}
	
	respBody, err := s.CallRPC(ctx, "chat_requests", req, 60*time.Second)
	if err != nil {
		return nil, err
	}

	var response ChatResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal chat response: %w", err)
	}

	return &response, nil
}
