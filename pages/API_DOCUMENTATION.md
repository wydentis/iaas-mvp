# IaaS MVP - Complete API Documentation

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [WebSocket Endpoints](#websocket-endpoints)
- [Frontend Integration Guide](#frontend-integration-guide)
- [Setup and Deployment](#setup-and-deployment)

---

## Overview

This is an Infrastructure as a Service (IaaS) platform that allows users to create and manage virtual private servers (VPS/containers) across distributed nodes. The system includes AI-powered hardware recommendations and chat consulting features.

**Tech Stack:**
- **Backend:** Go (Golang)
- **Databases:** PostgreSQL, Redis
- **Message Queue:** RabbitMQ
- **AI Services:** Python with Google Gemini API
- **Containerization:** Docker, LXD

**Base URL:** `http://localhost:8080`

---

## Architecture

### Core Components

1. **API Service** (Port 8080)
   - RESTful API built with Go
   - JWT-based authentication
   - WebSocket support for real-time features
   - CORS enabled for web clients

2. **Database** (PostgreSQL)
   - User management
   - Node (physical servers) registry
   - Container (VPS) tracking
   - Port mapping management

3. **RabbitMQ** (Ports 5672, 15672)
   - Hardware recommendation requests
   - AI chat message queue
   - Asynchronous task processing

4. **Redis** (Port 6379)
   - Chat history storage (20 messages per user, 24h TTL)
   - Session management

5. **Recommendation Service** (Python)
   - AI-powered hardware configuration suggestions
   - Gemini API integration

6. **AI Consult Service** (Python)
   - Real-time chat consulting
   - Context-aware responses with history

---

## Services

### API Service (Go)
**Container:** `iaas-api`
**Port:** 8080

Main REST API handling all HTTP requests, authentication, and business logic.

### Recommendation Service (Python)
**Container:** `python_worker`
**Queue:** `hardware_requests`

Analyzes user requirements and generates three-tier hardware configurations:
- **basic_minimum:** Minimal viable configuration
- **optimal:** Recommended balanced configuration
- **luxury_maximum:** High-performance configuration

### AI Consult Service (Python)
**Container:** `ai_consult_worker`
**Queue:** `chat_requests`

Provides conversational AI support with persistent chat history stored in Redis.

---

## API Endpoints

### Authentication

#### Sign Up
```http
POST /auth/signup
Content-Type: application/json

{
  "username": "string",
  "name": "string",
  "surname": "string",
  "email": "string",
  "phone": "string",
  "password": "string",
  "password_confirm": "string"
}
```

**Response (201):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": "2026-03-04T10:30:00Z"
}
```

#### Sign In
```http
POST /auth/signin
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "phone": "string",
  "password": "string"
}
```
*Note: You can use username, email, or phone for login*

**Response (200):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": "2026-03-04T10:30:00Z"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "string"
}
```

**Response (200):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": "2026-03-04T10:30:00Z"
}
```

---

### User Management

All user endpoints require `Authorization: Bearer <token>` header.

#### Get User Info
```http
GET /user/info
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "username": "string",
  "name": "string",
  "surname": "string",
  "email": "string",
  "phone": "string",
  "role": "user"
}
```

#### Update User Info
```http
PUT /user/info
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "string",
  "name": "string",
  "surname": "string",
  "email": "string",
  "phone": "string"
}
```

#### Update Password
```http
PUT /user/pass
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "string",
  "password_confirm": "string"
}
```

#### Get Balance
```http
GET /user/balance
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "amount": 1000
}
```

#### Change Balance
```http
PUT /user/balance
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500
}
```

---

### Admin Endpoints

All admin endpoints require admin role.

#### List All Users
```http
GET /admin/users
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
[
  {
    "user_id": "uuid",
    "username": "string",
    "name": "string",
    "surname": "string",
    "email": "string",
    "phone": "string",
    "balance": 0,
    "role": "user",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
]
```

#### Search Users
```http
GET /admin/user?query=searchterm
Authorization: Bearer <admin_token>
```

#### List All Containers
```http
GET /admin/containers
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
[
  {
    "container_id": "uuid",
    "node_id": "uuid",
    "user_id": "uuid",
    "name": "my-vps",
    "image": "ubuntu:22.04",
    "cpu": 2,
    "ram": 2048,
    "disk": 20,
    "status": "RUNNING",
    "ip_address": "10.0.0.5",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
]
```

---

### Node Management (Admin Only)

#### Create Node
```http
POST /admin/nodes
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "node-01",
  "ip_address": "192.168.1.100",
  "status": "active",
  "cpu_cores": 16,
  "ram": 32768,
  "disk_space": 500
}
```

#### List Nodes
```http
GET /admin/nodes
Authorization: Bearer <admin_token>
```

#### Get Node
```http
GET /admin/nodes/{id}
Authorization: Bearer <admin_token>
```

#### Update Node
```http
PUT /admin/nodes/{id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "node-01-updated",
  "ip_address": "192.168.1.100",
  "status": "active",
  "cpu_cores": 32,
  "ram": 65536,
  "disk_space": 1000
}
```

#### Delete Node
```http
DELETE /admin/nodes/{id}
Authorization: Bearer <admin_token>
```

---

### Public Nodes Endpoint

#### List Public Nodes (No Auth)
```http
GET /nodes
```

---

### Container (VPS) Management

#### List My Containers
```http
GET /vps
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "container_id": "uuid",
    "node_id": "uuid",
    "user_id": "uuid",
    "name": "my-vps",
    "image": "ubuntu:22.04",
    "cpu": 2,
    "ram": 2048,
    "disk": 20,
    "status": "RUNNING",
    "ip_address": "10.0.0.5",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
]
```

#### Create Container
```http
POST /vps
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "my-vps",
  "node_id": "uuid",
  "image": "ubuntu:22.04",
  "cpu": 2,
  "ram": 2048,
  "disk": 20,
  "start_script": "#!/bin/bash\napt update"
}
```

**Container Statuses:**
- `UNKNOWN` - Initial state
- `PENDING` - Creation in progress
- `RUNNING` - Active and running
- `STOPPED` - Stopped but not deleted
- `ERROR` - Error occurred

#### Get Container
```http
GET /vps/{id}
Authorization: Bearer <token>
```

#### Update Container Status
```http
PUT /vps/{id}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "RUNNING"
}
```
*Allowed statuses: RUNNING, STOPPED*

#### Update Container Info
```http
PUT /vps/{id}/info
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "new-name"
}
```

#### Update Container Specs
```http
PUT /vps/{id}/specs
Authorization: Bearer <token>
Content-Type: application/json

{
  "cpu": 4,
  "ram": 4096,
  "disk": 40
}
```

#### Delete Container
```http
DELETE /vps/{id}
Authorization: Bearer <token>
```

#### Run Command
```http
POST /vps/{id}/command
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "ls -la"
}
```

**Response (200):**
```json
{
  "output": "total 48\ndrwxr-xr-x 1 root root 4096..."
}
```

---

### Port Mapping

#### Create Port Mapping
```http
POST /vps/{id}/ports
Authorization: Bearer <token>
Content-Type: application/json

{
  "container_port": 80,
  "host_port": 8080,
  "protocol": "tcp"
}
```
*If host_port is omitted, it will be auto-assigned*

**Response (201):**
```json
{
  "id": "uuid",
  "container_id": "uuid",
  "host_port": 8080,
  "container_port": 80,
  "protocol": "tcp",
  "created_at": "2026-03-04T10:00:00Z",
  "updated_at": "2026-03-04T10:00:00Z"
}
```

#### Get Port Mappings
```http
GET /vps/{id}/ports
Authorization: Bearer <token>
```

#### Update Port Mapping
```http
PUT /vps/{id}/ports/{mapping_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "host_port": 9090,
  "container_port": 80
}
```

#### Delete Port Mapping
```http
DELETE /vps/{id}/ports/{mapping_id}
Authorization: Bearer <token>
```

---

### AI Services

#### Get Hardware Recommendation
```http
POST /ai/hardware-recommendation
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "I need to run a PostgreSQL database with 100k daily active users"
}
```

**Response (200):**
```json
{
  "basic_minimum": {
    "cpu_cores": 2,
    "ram_gb": 4,
    "disk_size_gb": 50,
    "reasoning": "Minimal setup for small DB workload"
  },
  "optimal": {
    "cpu_cores": 4,
    "ram_gb": 8,
    "disk_size_gb": 100,
    "reasoning": "Balanced config for 100k DAU with caching"
  },
  "luxury_maximum": {
    "cpu_cores": 8,
    "ram_gb": 16,
    "disk_size_gb": 250,
    "reasoning": "High availability with NVMe and in-memory support"
  }
}
```

---

## WebSocket Endpoints

### Container Terminal
```
ws://localhost:8080/vps/{id}/terminal
Authorization: Bearer <token>
```

**Send Message:**
```json
{
  "command": "ls -la"
}
```

**Receive Response:**
```json
{
  "output": "total 48\ndrwxr-xr-x...",
  "error": ""
}
```

### AI Chat
```
ws://localhost:8080/ai/chat
Authorization: Bearer <token>
```

**Send Message:**
```json
{
  "message": "How much RAM do I need for a Django app?"
}
```

**Receive Response:**
```json
{
  "user_id": "123",
  "response": "For a Django application...",
  "status": "success"
}
```

**Error Response:**
```json
{
  "user_id": "123",
  "status": "error",
  "error": "Failed to generate AI response"
}
```

### Admin Metrics Stream
```
ws://localhost:8080/admin/metrics
Authorization: Bearer <admin_token>
```

### Container Metrics Stream
```
ws://localhost:8080/vps/{id}/metrics
Authorization: Bearer <token>
```

---

## Data Models

### User
```typescript
interface User {
  user_id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  balance: number;
  role: string;
  created_at: string;
  updated_at: string;
}
```

### Container
```typescript
interface Container {
  container_id: string;
  node_id: string;
  user_id: string;
  name: string;
  image: string;
  cpu: number;        // CPU cores
  ram: number;        // MB
  disk: number;       // GB
  status: 'UNKNOWN' | 'PENDING' | 'RUNNING' | 'STOPPED' | 'ERROR';
  ip_address: string;
  created_at: string;
  updated_at: string;
}
```

### Node
```typescript
interface Node {
  node_id: string;
  name: string;
  ip_address: string;
  status: string;
  cpu_cores: number;
  ram: number;        // MB
  disk_space: number; // GB
  created_at: string;
  updated_at: string;
}
```

### PortMapping
```typescript
interface PortMapping {
  id: string;
  container_id: string;
  host_port: number;
  container_port: number;
  protocol: 'tcp' | 'udp';
  created_at: string;
  updated_at: string;
}
```

---

## Frontend Integration Guide

### React + Vite + Axios Setup

#### 1. Create React + Vite Project

```bash
npm create vite@latest iaas-frontend -- --template react-js
cd iaas-frontend
npm install
```

#### 2. Install Dependencies

```bash
npm install axios
npm install react-router-dom
```

For WebSocket support:
```bash
npm install socket.io-client
# or use native WebSocket API
```
## Setup and Deployment

### Prerequisites

- Docker & Docker Compose
- Gemini API Key (from Google AI Studio)

### Environment Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and set:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
JWT_SECRET=your_secure_random_string
```

Generate JWT secret:
```bash
openssl rand -base64 32
```

### Start Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- RabbitMQ (ports 5672, 15672)
- Redis (port 6379)
- API Service (port 8080)
- Recommendation Service
- AI Consult Service

### Verify Services

Check all services are running:
```bash
docker-compose ps
```

Check API health:
```bash
curl http://localhost:8080/health
```

Access RabbitMQ Management UI:
```
http://localhost:15672
Username: guest
Password: guest
```

### Database Schema

The database is automatically initialized with the schema from `deploy/init.sql`:
- Users table
- Nodes table
- Containers table
- Port mappings table

### Stop Services

```bash
docker-compose down
```

To remove volumes (delete all data):
```bash
docker-compose down -v
```

### Production Deployment

1. Update CORS origins in `backend/api/cmd/api/main.go`:
```go
allowedOrigins := []string{
    "https://your-frontend-domain.com",
}
```

2. Use strong JWT secret
3. Configure proper SSL/TLS
4. Use production-grade PostgreSQL
5. Implement rate limiting
6. Set up monitoring and logging

---

## Additional Notes

### CORS Configuration

The API is configured to accept requests from:
- `https://serverdam.wydentis.xyz` (production)

For local development, you may need to add `http://localhost:5173` (Vite default port) to the CORS allowed origins.

### Authentication Flow

1. User signs up or signs in
2. Backend returns `access_token` and `refresh_token`
3. Frontend stores tokens in localStorage
4. Frontend includes `Authorization: Bearer <access_token>` in all requests
5. When access token expires, use refresh token to get new tokens
6. If refresh fails, redirect to login

### WebSocket Authentication

WebSocket connections don't support custom headers in browsers. The token should be included in the connection URL or sent as the first message after connection.

**Current implementation:** Token is validated from the HTTP upgrade request context.

### Error Handling

Standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., user already exists)
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "error message description"
}
```

---

## Support & Resources

- Postman Workspace: [iaas-mvp postman workspace](https://wydent.postman.co/workspace/25aeec73-32a5-4607-bb04-ca10e1dae8b9)
- Repository: Check README.md for additional information

---

**Last Updated:** 2026-03-04
