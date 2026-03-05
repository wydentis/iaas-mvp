# API Endpoints - Complete Reference for AI/LLM Consumption

**Purpose:** This document describes ALL available API endpoints in a structured format optimized for AI/LLM parsing.

**Base URL:** `https://serverdam.wydentis.xyz/api`

**Authentication:** Most endpoints require `Authorization: Bearer <token>` header

---

## AUTHENTICATION ENDPOINTS (No Auth Required)

### 1. Sign Up - Create New User Account
- **Method:** POST
- **Path:** `/auth/signup`
- **Auth Required:** NO
- **What it does:** Registers a new user in the system
- **Request Body:**
  ```json
  {
    "username": "string (required)",
    "name": "string (required)",
    "surname": "string (required)",
    "email": "string (required)",
    "phone": "string (required)",
    "password": "string (required)",
    "password_confirm": "string (required, must match password)"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "access_token": "JWT string",
    "refresh_token": "JWT string",
    "expires_in": "ISO 8601 timestamp"
  }
  ```
- **Errors:**
  - 400: Passwords don't match OR invalid request
  - 409: User already exists

---

### 2. Sign In - Authenticate User
- **Method:** POST
- **Path:** `/auth/signin`
- **Auth Required:** NO
- **What it does:** Authenticates user and returns tokens
- **Request Body (Option 1 - Email):**
  ```json
  {
    "email": "string (required)",
    "password": "string (required)"
  }
  ```
- **Request Body (Option 2 - Username):**
  ```json
  {
    "username": "string (required)",
    "password": "string (required)"
  }
  ```
- **Request Body (Option 3 - Phone):**
  ```json
  {
    "phone": "string (required)",
    "password": "string (required)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "access_token": "JWT string",
    "refresh_token": "JWT string",
    "expires_in": "ISO 8601 timestamp"
  }
  ```
- **Errors:**
  - 400: Invalid request
  - 401: Incorrect password
  - 404: User not found

---

### 3. Refresh Token - Get New Access Token
- **Method:** POST
- **Path:** `/auth/refresh`
- **Auth Required:** NO (but needs refresh token)
- **What it does:** Exchanges refresh token for new access token
- **Request Body:**
  ```json
  {
    "refresh_token": "string (required)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "access_token": "JWT string",
    "refresh_token": "JWT string",
    "expires_in": "ISO 8601 timestamp"
  }
  ```
- **Errors:**
  - 400: Invalid request
  - 401: Invalid refresh token

---

### 4. Health Check
- **Method:** GET
- **Path:** `/health`
- **Auth Required:** NO
- **What it does:** Returns API health status
- **Success Response (200):**
  ```json
  {
    "status": "healthy",
    "timestamp": "ISO 8601 timestamp"
  }
  ```

---

## USER MANAGEMENT ENDPOINTS (Auth Required)

### 5. Get Current User Info
- **Method:** GET
- **Path:** `/user/info`
- **Auth Required:** YES
- **What it does:** Returns authenticated user's profile information
- **Success Response (200):**
  ```json
  {
    "username": "string",
    "name": "string",
    "surname": "string",
    "email": "string",
    "phone": "string",
    "role": "user|admin"
  }
  ```

---

### 6. Update User Info
- **Method:** PUT
- **Path:** `/user/info`
- **Auth Required:** YES
- **What it does:** Updates user profile information
- **Request Body:**
  ```json
  {
    "username": "string (optional)",
    "name": "string (optional)",
    "surname": "string (optional)",
    "email": "string (optional)",
    "phone": "string (optional)"
  }
  ```
- **Success Response (200):** Same as Get User Info

---

### 7. Update Password
- **Method:** PUT
- **Path:** `/user/pass`
- **Auth Required:** YES
- **What it does:** Changes user password
- **Request Body:**
  ```json
  {
    "password": "string (required)",
    "password_confirm": "string (required, must match)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "message": "password updated successfully"
  }
  ```
- **Errors:**
  - 400: Passwords don't match

---

### 8. Get User Balance
- **Method:** GET
- **Path:** `/user/balance`
- **Auth Required:** YES
- **What it does:** Returns user account balance
- **Success Response (200):**
  ```json
  {
    "amount": 1500
  }
  ```

---

### 9. Change User Balance
- **Method:** PUT
- **Path:** `/user/balance`
- **Auth Required:** YES
- **What it does:** Adds or subtracts from user balance
- **Request Body:**
  ```json
  {
    "amount": 500
  }
  ```
- **Success Response (200):**
  ```json
  {
    "amount": 2000
  }
  ```

---

## ADMIN ENDPOINTS (Auth + Admin Role Required)

### 10. List All Users
- **Method:** GET
- **Path:** `/admin/users`
- **Auth Required:** YES (Admin only)
- **What it does:** Returns list of all users in system
- **Success Response (200):**
  ```json
  [
    {
      "user_id": "UUID string",
      "username": "string",
      "name": "string",
      "surname": "string",
      "email": "string",
      "phone": "string",
      "balance": 1500,
      "role": "user|admin",
      "created_at": "ISO 8601 timestamp",
      "updated_at": "ISO 8601 timestamp"
    }
  ]
  ```
- **Errors:**
  - 403: Not an admin

---

### 11. Search Users
- **Method:** GET
- **Path:** `/admin/user`
- **Query Parameters:** `email=...` OR `username=...` OR `phone=...`
- **Auth Required:** YES (Admin only)
- **What it does:** Searches for specific user by email, username, or phone
- **Success Response (200):**
  ```json
  {
    "user_id": "UUID string",
    "username": "string",
    "email": "string",
    "balance": 1500,
    "role": "user|admin"
  }
  ```

---

### 12. List All Containers (Admin)
- **Method:** GET
- **Path:** `/admin/containers`
- **Auth Required:** YES (Admin only)
- **What it does:** Returns all containers from all users
- **Success Response (200):**
  ```json
  [
    {
      "container_id": "string",
      "node_id": "string",
      "user_id": "UUID",
      "name": "string",
      "image": "docker image name",
      "cpu": 4,
      "ram": 8192,
      "disk": 100,
      "status": "UNKNOWN|PENDING|RUNNING|STOPPED|ERROR",
      "ip_address": "string",
      "created_at": "ISO 8601 timestamp",
      "updated_at": "ISO 8601 timestamp"
    }
  ]
  ```

---

## NODE MANAGEMENT ENDPOINTS

### 13. Create Node (Admin)
- **Method:** POST
- **Path:** `/admin/nodes`
- **Auth Required:** YES (Admin only)
- **What it does:** Adds new physical/virtual node to cluster
- **Request Body:**
  ```json
  {
    "name": "string (required)",
    "ip_address": "string (required)",
    "status": "string (required)",
    "cpu_cores": 32,
    "ram": 128000,
    "disk_space": 2000
  }
  ```
- **Success Response (201):**
  ```json
  {
    "node_id": "string",
    "name": "string",
    "ip_address": "string",
    "status": "string",
    "cpu_cores": 32,
    "ram": 128000,
    "disk_space": 2000,
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  }
  ```

---

### 14. List Nodes (Admin)
- **Method:** GET
- **Path:** `/admin/nodes`
- **Auth Required:** YES (Admin only)
- **What it does:** Returns all nodes in cluster
- **Success Response (200):** Array of node objects (same as Create Node response)

---

### 15. Get Single Node (Admin)
- **Method:** GET
- **Path:** `/admin/nodes/{id}`
- **Auth Required:** YES (Admin only)
- **What it does:** Returns specific node details
- **Success Response (200):** Single node object

---

### 16. Update Node (Admin)
- **Method:** PUT
- **Path:** `/admin/nodes/{id}`
- **Auth Required:** YES (Admin only)
- **What it does:** Updates node information
- **Request Body:** Same as Create Node
- **Success Response (200):** Updated node object

---

### 17. Delete Node (Admin)
- **Method:** DELETE
- **Path:** `/admin/nodes/{id}`
- **Auth Required:** YES (Admin only)
- **What it does:** Removes node from cluster
- **Success Response (200):**
  ```json
  {
    "message": "node deleted successfully"
  }
  ```

---

### 18. List Public Nodes (No Auth)
- **Method:** GET
- **Path:** `/nodes`
- **Auth Required:** NO
- **What it does:** Returns available nodes (public view)
- **Success Response (200):** Array of node objects

---

## VPS/CONTAINER MANAGEMENT ENDPOINTS

### 19. List My Containers
- **Method:** GET
- **Path:** `/vps`
- **Auth Required:** YES
- **What it does:** Returns all containers owned by authenticated user
- **Success Response (200):**
  ```json
  [
    {
      "container_id": "string",
      "node_id": "string",
      "user_id": "UUID",
      "name": "string",
      "image": "docker image",
      "cpu": 2,
      "ram": 4096,
      "disk": 50,
      "status": "UNKNOWN|PENDING|RUNNING|STOPPED|ERROR",
      "ip_address": "string",
      "created_at": "ISO 8601 timestamp",
      "updated_at": "ISO 8601 timestamp"
    }
  ]
  ```

---

### 20. Create Container
- **Method:** POST
- **Path:** `/vps`
- **Auth Required:** YES
- **What it does:** Creates new VPS container
- **Request Body:**
  ```json
  {
    "name": "string (required)",
    "node_id": "string (required)",
    "image": "string (required, docker image)",
    "cpu": 4,
    "ram": 8192,
    "disk": 100,
    "start_script": "string (optional)"
  }
  ```
- **Success Response (201):** Container object
- **Errors:**
  - 400: Invalid request or insufficient resources
  - 500: Failed to create container

---

### 21. Get Container Details
- **Method:** GET
- **Path:** `/vps/{id}`
- **Auth Required:** YES
- **What it does:** Returns specific container details (user must own it or be admin)
- **Success Response (200):** Single container object
- **Errors:**
  - 401: Not authorized
  - 404: Container not found

---

### 22. Delete Container
- **Method:** DELETE
- **Path:** `/vps/{id}`
- **Auth Required:** YES
- **What it does:** Permanently deletes container
- **Success Response (200):**
  ```json
  {
    "message": "container deleted successfully"
  }
  ```
- **Errors:**
  - 401: Not authorized
  - 404: Container not found

---

### 23. Update Container Status
- **Method:** PUT
- **Path:** `/vps/{id}/status`
- **Auth Required:** YES
- **What it does:** Starts or stops container
- **Request Body:**
  ```json
  {
    "status": "RUNNING|STOPPED"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "container_id": "string",
    "status": "RUNNING|STOPPED",
    "message": "status updated successfully"
  }
  ```

---

### 24. Update Container Info
- **Method:** PUT
- **Path:** `/vps/{id}/info`
- **Auth Required:** YES
- **What it does:** Updates container name or image
- **Request Body:**
  ```json
  {
    "name": "string (optional)",
    "image": "string (optional)"
  }
  ```
- **Success Response (200):** Updated container object

---

### 25. Update Container Specs
- **Method:** PUT
- **Path:** `/vps/{id}/specs`
- **Auth Required:** YES
- **What it does:** Resizes container resources
- **Request Body:**
  ```json
  {
    "cpu": 8,
    "ram": 16384,
    "disk": 200
  }
  ```
- **Success Response (200):** Updated container object
- **Errors:**
  - 400: Insufficient node resources

---

### 26. Run Command in Container
- **Method:** POST
- **Path:** `/vps/{id}/command`
- **Auth Required:** YES
- **What it does:** Executes shell command inside container
- **Request Body:**
  ```json
  {
    "command": "string (required)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "output": "command output string",
    "exit_code": 0
  }
  ```
- **Errors:**
  - 401: Not authorized
  - 404: Container not found

---

## PORT MAPPING ENDPOINTS

### 27. Create Port Mapping
- **Method:** POST
- **Path:** `/vps/{id}/ports`
- **Auth Required:** YES
- **What it does:** Maps container port to host port (exposes to internet)
- **Request Body:**
  ```json
  {
    "container_port": 5432,
    "host_port": 5432,
    "protocol": "tcp|udp"
  }
  ```
  Note: host_port is optional - will auto-assign if not provided
- **Success Response (201):**
  ```json
  {
    "id": "string",
    "container_id": "string",
    "host_port": 5432,
    "container_port": 5432,
    "protocol": "tcp|udp",
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  }
  ```

---

### 28. Get Port Mappings
- **Method:** GET
- **Path:** `/vps/{id}/ports`
- **Auth Required:** YES
- **What it does:** Lists all port mappings for container
- **Success Response (200):** Array of port mapping objects

---

### 29. Update Port Mapping
- **Method:** PUT
- **Path:** `/vps/{id}/ports/{mapping_id}`
- **Auth Required:** YES
- **What it does:** Updates existing port mapping
- **Request Body:**
  ```json
  {
    "host_port": 5433,
    "container_port": 5432
  }
  ```
- **Success Response (200):** Updated port mapping object

---

### 30. Delete Port Mapping
- **Method:** DELETE
- **Path:** `/vps/{id}/ports/{mapping_id}`
- **Auth Required:** YES
- **What it does:** Removes port mapping
- **Success Response (200):**
  ```json
  {
    "message": "port mapping deleted successfully"
  }
  ```

---

## WEBSOCKET ENDPOINTS

### 31. Container Terminal (WebSocket)
- **Method:** GET (WebSocket upgrade)
- **Path:** `/vps/{id}/terminal`
- **Auth Required:** YES
- **Protocol:** WebSocket
- **What it does:** Provides interactive terminal access to container
- **Client Sends:**
  ```json
  {
    "command": "string"
  }
  ```
- **Server Responds:**
  ```json
  {
    "output": "command output",
    "error": "error message or empty"
  }
  ```

---

### 32. Admin Metrics Stream (WebSocket)
- **Method:** GET (WebSocket upgrade)
- **Path:** `/admin/metrics`
- **Auth Required:** YES (Admin only)
- **Protocol:** WebSocket
- **What it does:** Streams real-time metrics for all nodes and containers
- **Server Sends Periodically:**
  ```json
  {
    "timestamp": "ISO 8601",
    "nodes": [
      {
        "node_id": "string",
        "cpu_usage": 45.2,
        "ram_usage": 65.8,
        "disk_usage": 30.5
      }
    ],
    "containers": [
      {
        "container_id": "string",
        "cpu_usage": 15.3,
        "ram_usage": 45.7,
        "network_rx_bytes": 1048576,
        "network_tx_bytes": 524288
      }
    ]
  }
  ```

---

### 33. Container Metrics Stream (WebSocket)
- **Method:** GET (WebSocket upgrade)
- **Path:** `/vps/{id}/metrics`
- **Auth Required:** YES
- **Protocol:** WebSocket
- **What it does:** Streams real-time metrics for specific container
- **Server Sends Periodically:**
  ```json
  {
    "timestamp": "ISO 8601",
    "container_id": "string",
    "cpu_usage": 15.3,
    "ram_usage": 45.7,
    "disk_usage": 25.0,
    "network_rx_bytes": 1048576,
    "network_tx_bytes": 524288
  }
  ```

---

## AI SERVICE ENDPOINTS

### 34. AI Hardware Recommendation
- **Method:** POST
- **Path:** `/ai/hardware-recommendation`
- **Auth Required:** YES
- **What it does:** Uses AI to recommend server configurations based on text description
- **Processing Time:** Up to 60 seconds
- **Request Body:**
  ```json
  {
    "text": "string (required, description of requirements)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "basic_minimum": {
      "cpu_cores": 2,
      "ram_gb": 4,
      "disk_size_gb": 120,
      "reasoning": "string"
    },
    "optimal": {
      "cpu_cores": 8,
      "ram_gb": 32,
      "disk_size_gb": 200,
      "reasoning": "string"
    },
    "luxury_maximum": {
      "cpu_cores": 16,
      "ram_gb": 64,
      "disk_size_gb": 500,
      "reasoning": "string"
    }
  }
  ```
- **Errors:**
  - 400: Missing or empty text
  - 500: AI service timeout or unavailable

---

### 35. AI Chat Consultant (WebSocket)
- **Method:** GET (WebSocket upgrade)
- **Path:** `/ai/chat`
- **Auth Required:** YES
- **Protocol:** WebSocket
- **What it does:** Interactive AI chat with conversation history
- **Features:**
  - Maintains last 20 messages per user
  - 24-hour conversation expiry
  - Per-user isolated history in Redis
  - Processing: Up to 60 seconds per message
  - Idle timeout: 120 seconds
- **Client Sends:**
  ```json
  {
    "message": "string (required)"
  }
  ```
- **Server Responds (Success):**
  ```json
  {
    "user_id": "string",
    "response": "AI generated response",
    "status": "success"
  }
  ```
- **Server Responds (Error):**
  ```json
  {
    "user_id": "string",
    "status": "error",
    "error": "error description"
  }
  ```

---

## SUMMARY

**Total Endpoints:** 35

**Breakdown by Category:**
- Authentication: 4 endpoints (no auth required)
- User Management: 5 endpoints (auth required)
- Admin User Management: 3 endpoints (admin only)
- Node Management: 6 endpoints (5 admin, 1 public)
- VPS/Container Management: 8 endpoints (auth required)
- Port Mappings: 4 endpoints (auth required)
- WebSocket Real-time: 3 endpoints (auth required)
- AI Services: 2 endpoints (auth required)

**Authentication Types:**
1. No Auth Required: 5 endpoints
2. User Auth Required: 22 endpoints
3. Admin Auth Required: 8 endpoints

**HTTP Methods Used:**
- GET: 15 endpoints
- POST: 8 endpoints
- PUT: 7 endpoints
- DELETE: 3 endpoints
- WebSocket: 4 endpoints (use GET for upgrade)

**Response Formats:**
- All endpoints return JSON
- WebSocket endpoints use JSON messages
- Error responses: `{"error": "message"}`
- Success messages: `{"message": "success text"}`

**Common Error Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden (not admin)
- 404: Not Found
- 409: Conflict (already exists)
- 500: Internal Server Error

**Important Notes for AI/LLM:**
1. All authenticated endpoints need `Authorization: Bearer <token>` header
2. Tokens expire - use refresh token to get new access token
3. Admin endpoints check user role - regular users get 403
4. Container operations check ownership - users can only access their own containers
5. WebSocket connections require auth token and close after 120s inactivity
6. AI endpoints have 60-second processing timeout
7. All timestamps are ISO 8601 format
8. Container status values: UNKNOWN, PENDING, RUNNING, STOPPED, ERROR
9. User roles: "user" or "admin"
10. Port protocols: "tcp" or "udp"

**Data Flow:**
1. User signs up/in → Gets tokens
2. User creates container → Container created on node
3. User adds port mapping → Port exposed to internet
4. User can monitor metrics via WebSocket
5. User can execute commands in container
6. User can ask AI for hardware recommendations
7. User can chat with AI consultant
8. Admin can manage users, nodes, and view all containers

**WebSocket Usage:**
- Connect: `new WebSocket('wss://serverdam.wydentis.xyz/api/<path>')`
- Auth: Include token in connection or first message
- Send: `ws.send(JSON.stringify({...}))`
- Receive: `ws.onmessage = (event) => JSON.parse(event.data)`
- All WebSocket endpoints use bidirectional JSON messaging

**Resource Hierarchy:**
```
Users
  ├─ Containers (VPS)
  │   ├─ Port Mappings
  │   ├─ Metrics
  │   └─ Terminal Access
  └─ Balance

Nodes (physical servers)
  └─ Host Containers

AI Services
  ├─ Hardware Recommendations (one-time)
  └─ Chat Consultant (conversational with memory)
```

---

**Generated:** 2026-03-04T02:12:36Z
**API Version:** 1.0
**Base URL:** https://serverdam.wydentis.xyz/api
