package handler

import (
	"context"
	"log/slog"
	"time"

	"google.golang.org/grpc"
)

func LoggingInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()

	resp, err := handler(ctx, req)

	duration := time.Since(start)

	level := slog.LevelInfo
	if err != nil {
		level = slog.LevelError
	}

	slog.Log(ctx, level, "grpc request",
		"method", info.FullMethod,
		"duration_ms", duration.Milliseconds(),
		"error", err,
	)

	return resp, err
}
