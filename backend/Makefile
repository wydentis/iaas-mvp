run-api:
	cd api && go run cmd/api/main.go

run-agent:
	cd agent && go run cmd/server/main.go

gen-proto:
	protoc --go_out=. --go_opt=paths=source_relative \
	--go-grpc_out=. --go-grpc_opt=paths=source_relative \
	proto/node.proto