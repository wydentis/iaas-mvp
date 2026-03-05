# Private Network Endpoints Documentation

## Overview

Private networks in this IaaS platform allow you to group your containers (VPS instances) and track which servers are logically connected. When you attach a container to a private network, the system records the container's **actual LXD bridge IP** — the same IP the container uses on the host network.

## How Private Networks Actually Work

All LXD containers on a node share a single bridge (`lxdbr0`). Each container gets a real IP address from this bridge (e.g., `10.182.169.x` on node-1). When you create a "private network" and attach containers, the system:

1. Records the network as metadata in PostgreSQL (name, description, subnet label)
2. Stores each attached container's **real IP address** (from `containers.ip_address`) in `network_attachments`
3. Containers on the same node can already ping each other using these real IPs

**Important**: The network subnet/gateway fields are organizational labels. The actual connectivity between containers is provided by the shared LXD bridge on each node.

### Public Access

Containers do not get dedicated public IPs. Public access is provided via **port mappings** — each container can have host ports forwarded to its internal ports (e.g., `host:12345 → container:22`). This is configured when creating the container or via the port mapping API.

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
  "container_id": "container-uuid"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "network_id": "network-uuid",
  "container_id": "container-uuid",
  "ip_address": "10.182.169.42",
  "created_at": "2026-03-04T13:00:00Z"
}
```

**How IP Assignment Works:**
- The system looks up the container's actual IP address from the `containers` table
- This is the real IP assigned by the LXD bridge (e.g., `lxdbr0`)
- Containers on the same node can ping each other using these IPs

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
- **Real IPs**: When attaching a container, the system uses the container's actual LXD bridge IP (not a fictional/generated IP)
- **Same-Node Connectivity**: Containers on the same node can reach each other via their real IPs (they share the LXD bridge)
- **Multi-Network Support**: A single container can be attached to multiple networks for organizational purposes
- **Public Access**: There are no dedicated public IPs — use port mappings for external access
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
