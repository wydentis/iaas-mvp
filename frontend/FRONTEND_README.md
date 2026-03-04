# IaaS MVP Frontend

Complete React frontend for the IaaS platform with all backend features integrated.

## Features

### User Features
- ✅ Authentication (Login/Register)
- ✅ Server Dashboard (list all VPS)
- ✅ Create Server Wizard (3-step process)
  - OS Selection (Ubuntu, Debian, CentOS, Windows, etc.)
  - Region Selection
  - Configuration with AI recommendations
- ✅ Server Details Page
  - Dashboard with metrics
  - Network configuration
  - Terminal/Console access via WebSocket
  - Server controls (start, stop, delete)
  - Port management
- ✅ Profile Management
  - Update personal info
  - Change password
  - Balance management
- ✅ AI Chat Assistant (global floating chat)
- ✅ Hardware Recommendations via AI

### Admin Features
- ✅ User Management
  - List all users
  - Search users
  - View user details
- ✅ Container Management
  - List all containers across all users
  - View statistics
- ✅ Node Management
  - Create/Delete nodes
  - View node statistics
  - Monitor resources

## API Integration

All backend endpoints are integrated:

### Authentication
- POST /auth/signup
- POST /auth/signin
- POST /auth/refresh

### User Management
- GET /user/info
- PUT /user/info
- PUT /user/pass
- GET /user/balance
- PUT /user/balance

### Container (VPS) Management
- GET /vps
- POST /vps
- GET /vps/:id
- PUT /vps/:id/status
- PUT /vps/:id/info
- PUT /vps/:id/specs
- DELETE /vps/:id
- POST /vps/:id/command

### Port Mapping
- GET /vps/:id/ports
- POST /vps/:id/ports
- PUT /vps/:id/ports/:mapping_id
- DELETE /vps/:id/ports/:mapping_id

### AI Services
- POST /ai/hardware-recommendation
- WS /ai/chat

### WebSocket Endpoints
- WS /vps/:id/terminal
- WS /vps/:id/metrics

### Admin Endpoints
- GET /admin/users
- GET /admin/user?query=
- GET /admin/containers
- GET /admin/nodes
- POST /admin/nodes
- DELETE /admin/nodes/:id

## Tech Stack

- React 19
- React Router DOM 7
- Axios (API client with auto-refresh)
- WebSocket (native API)
- Lucide React (icons)
- Vite (build tool)

## Project Structure

```
src/
├── api/
│   └── axios.js              # Axios instance with interceptors
├── components/
│   ├── common/
│   │   ├── AIChat.jsx        # Floating AI chat
│   │   └── Button.jsx        # Reusable button component
│   └── layout/
│       └── Header.jsx        # Main header with navigation
├── contexts/
│   └── AuthContext.jsx       # Authentication context
├── pages/
│   ├── Auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── Servers/
│   │   ├── Dashboard.jsx     # Server list
│   │   ├── CreateServer.jsx  # Creation wizard
│   │   └── ServerDetails.jsx # Server management
│   ├── Profile/
│   │   └── Profile.jsx       # User profile
│   └── Admin/
│       ├── AdminUsers.jsx
│       ├── AdminContainers.jsx
│       └── AdminNodes.jsx
├── utils/
│   ├── pricing.js            # Price calculation
│   └── websocket.js          # WebSocket client wrapper
├── App.jsx                    # Main app with routes
└── main.jsx                   # Entry point
```

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
```

## Design Reference

The UI follows the design mockups from the pages folder:
- page1.png - Server dashboard
- page2.png - Profile management
- page3.png - Server details with metrics
- page4.png - Create server wizard (OS & Region)
- page5.png - Create server wizard (Configuration & Pricing)

## Notes

- All prices are in RUB (₽)
- Pricing model matches the design specs
- WebSocket connections require valid JWT token
- Admin features are role-gated
- AI features require Gemini API to be configured on backend
