# Private Network Endpoints Documentation

## Overview

Private networks in this IaaS platform allow you to create isolated network segments for your containers (VPS instances). Each network has its own subnet, gateway, and IP address management system.

## Network Architecture

- **Subnet Range**: Auto-generated from 10.0.0.0/8 private range (typically /24 networks)
- **Gateway**: Automatically assigned as the first IP (.1) in the subnet
- **IP Allocation**: Container IPs start from .2 and are auto-assigned
- **Multi-Network**: Containers can belong to multiple networks simultaneously

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Network Management Endpoints

### Create Network
```http
POST /networks
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "production-network",
  "description": "Network for production services",
  "subnet": "10.100.5.0/24"  // Optional: auto-generated if omitted
}
```

**Response (201 Created):**
```json
{
  "network_id": "uuid",
  "user_id": "uuid",
  "name": "production-network",
  "description": "Network for production services",
  "subnet": "10.100.5.0/24",
  "gateway": "10.100.5.1",
  "created_at": "2026-03-04T13:00:00Z",
  "updated_at": "2026-03-04T13:00:00Z"
}
```

### List Networks
```http
GET /networks
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "network_id": "uuid",
    "user_id": "uuid",
    "name": "production-network",
    "description": "Network for production services",
    "subnet": "10.100.5.0/24",
    "gateway": "10.100.5.1",
    "created_at": "2026-03-04T13:00:00Z",
    "updated_at": "2026-03-04T13:00:00Z"
  }
]
```

### Get Network Details
```http
GET /networks/{id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "network_id": "uuid",
  "user_id": "uuid",
  "name": "production-network",
  "description": "Network for production services",
  "subnet": "10.100.5.0/24",
  "gateway": "10.100.5.1",
  "created_at": "2026-03-04T13:00:00Z",
  "updated_at": "2026-03-04T13:00:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Network doesn't exist
- `403 Forbidden` - Not authorized to access this network

### Update Network
```http
PUT /networks/{id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "updated-network-name",
  "description": "Updated description"
}
```

**Response (200 OK):**
```json
{
  "network_id": "uuid",
  "user_id": "uuid",
  "name": "updated-network-name",
  "description": "Updated description",
  "subnet": "10.100.5.0/24",
  "gateway": "10.100.5.1",
  "created_at": "2026-03-04T13:00:00Z",
  "updated_at": "2026-03-04T13:05:00Z"
}
```

### Delete Network
```http
DELETE /networks/{id}
Authorization: Bearer <token>
```

**Response (204 No Content)**

**Error Responses:**
- `404 Not Found` - Network doesn't exist
- `403 Forbidden` - Not authorized
- `409 Conflict` - Cannot delete network with attached containers (detach containers first)

---

## Container Attachment Endpoints

### Attach Container to Network
```http
POST /networks/{id}/containers
Content-Type: application/json
Authorization: Bearer <token>

{
  "container_id": "container-uuid",
  "ip_address": "10.100.5.10"  // Optional: auto-assigned if omitted
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "network_id": "network-uuid",
  "container_id": "container-uuid",
  "ip_address": "10.100.5.10",
  "created_at": "2026-03-04T13:00:00Z"
}
```

**How IP Auto-Assignment Works:**
- System scans the network subnet for available IPs
- Starts from .2 (skips .1 which is gateway)
- Returns first available IP not currently assigned

**Error Responses:**
- `404 Not Found` - Network or container doesn't exist
- `403 Forbidden` - Not authorized to access network or container
- `400 Bad Request` - IP address not in network subnet or no available IPs

### Detach Container from Network
```http
DELETE /networks/{id}/containers/{container_id}
Authorization: Bearer <token>
```

**Response (204 No Content)**

**Error Responses:**
- `404 Not Found` - Network or container doesn't exist
- `403 Forbidden` - Not authorized

### List Containers in Network
```http
GET /networks/{id}/containers
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "network_id": "network-uuid",
    "container_id": "container-uuid",
    "ip_address": "10.100.5.10",
    "created_at": "2026-03-04T13:00:00Z"
  },
  {
    "id": "uuid",
    "network_id": "network-uuid",
    "container_id": "container-uuid-2",
    "ip_address": "10.100.5.11",
    "created_at": "2026-03-04T13:00:00Z"
  }
]
```

### List Networks for Container
```http
GET /vps/{id}/networks
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "network_id": "uuid",
    "user_id": "uuid",
    "name": "production-network",
    "description": "Network for production services",
    "subnet": "10.100.5.0/24",
    "gateway": "10.100.5.1",
    "created_at": "2026-03-04T13:00:00Z",
    "updated_at": "2026-03-04T13:00:00Z"
  }
]
```

---

## Use Cases for AI

### 1. Create Isolated Environment
When a user requests isolated infrastructure:
1. Create a private network
2. Deploy containers
3. Attach containers to the network
4. Containers can communicate via private IPs

### 2. Multi-Tier Application Setup
For applications with frontend, backend, and database:
1. Create separate networks (e.g., "web-tier", "app-tier", "db-tier")
2. Attach relevant containers to appropriate networks
3. A backend container can belong to both "app-tier" and "db-tier" for segmented access

### 3. Network Segregation
Separate development, staging, and production environments using different networks.

### 4. Subnet Planning
If user needs specific subnet ranges, provide the `subnet` parameter during network creation. Otherwise, system auto-generates non-conflicting subnets.

---

## Important Notes

- **Authorization**: All operations verify user ownership of both networks and containers
- **Deletion Safety**: Networks with attached containers cannot be deleted
- **IP Validation**: Manually specified IPs must be within the network subnet
- **Multi-Network Support**: A single container can be attached to multiple networks, receiving a different IP in each
- **Automatic Management**: Gateway IP and subnet generation are handled automatically unless explicitly specified

---

## Error Handling Summary

| Status Code | Meaning |
|------------|---------|
| 200 | Success |
| 201 | Created successfully |
| 204 | Deleted/detached successfully |
| 400 | Invalid request (bad IP, no available IPs) |
| 403 | Unauthorized (not your resource) |
| 404 | Resource not found |
| 409 | Conflict (e.g., deleting network with containers) |
| 500 | Internal server error |
