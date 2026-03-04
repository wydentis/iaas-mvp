# IaaS MVP - Infrastructure as a Service Platform

MTS x BSU hackathon solution from LSBU team

## 🌟 Features

### User Features
- Complete VPS/Container management
- 3-step server creation wizard with AI recommendations
- Real-time terminal access via WebSocket
- Server metrics and monitoring
- Port mapping management
- AI-powered chat assistant
- Profile and balance management

### Admin Features
- User management and search
- Container oversight across all users
- Node management (CRUD operations)
- System-wide statistics and monitoring

## 🏗️ Architecture

- **Backend:** Go (Golang) with Gin framework
- **Database:** PostgreSQL
- **Cache:** Redis
- **Message Queue:** RabbitMQ
- **AI Services:** Python with Google Gemini API
- **Frontend:** React 19 + Vite
- **Containerization:** Docker, LXD

## 📚 Documentation

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes
- **[Frontend README](frontend/FRONTEND_README.md)** - Frontend-specific documentation
- **[Frontend Rewrite Summary](FRONTEND_REWRITE_SUMMARY.md)** - Details on the frontend implementation
- **[Postman Workspace](https://wydent.postman.co/workspace/25aeec73-32a5-4607-bb04-ca10e1dae8b9)** - API testing collection

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Setup

1. **Clone and configure:**
```bash
git clone <repository>
cd iaas-mvp
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

2. **Start backend services:**
```bash
docker-compose up -d
```

3. **Start frontend:**
```bash
cd frontend
npm install
npm run dev
```

4. **Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- RabbitMQ Management: http://localhost:15672 (guest/guest)

### Create Admin User

After starting the backend, create an admin user:

```bash
# Connect to PostgreSQL
docker exec -it iaas-db psql -U postgres -d iaas

# Set user as admin
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

## 📁 Project Structure

```
iaas-mvp/
├── backend/           # Go backend service
├── frontend/          # React frontend application
├── ai-consult-service/   # Python AI chat service
├── recommendation-service/ # Python hardware recommendation service
├── deploy/            # Deployment configurations
├── pages/             # Design reference images
└── docker-compose.yml # Docker orchestration
```

## 🔧 Development

### Backend
```bash
cd backend/api
go run cmd/api/main.go
```

### Frontend
```bash
cd frontend
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
```

### AI Services
```bash
cd ai-consult-service
pip install -r requirements.txt
python consumer.py

cd recommendation-service
pip install -r requirements.txt
python consumer.py
```

## 🎨 Design Reference

The UI implementation is based on the mockups in the `pages/` directory:
- page1.png - Server dashboard
- page2.png - Profile management
- page3.png - Server details with metrics
- page4.png - Create server wizard (OS & Region)
- page5.png - Create server wizard (Configuration & Pricing)

## 🔑 Key Technologies

### Backend
- **Gin** - HTTP web framework
- **GORM** - ORM for PostgreSQL
- **JWT** - Authentication
- **Gorilla WebSocket** - Real-time communication
- **LXD** - Container management

### Frontend
- **React 19** - UI framework
- **React Router v7** - Client-side routing
- **Axios** - HTTP client
- **WebSocket** - Real-time features

### AI Services
- **Google Gemini API** - AI-powered recommendations and chat
- **RabbitMQ** - Message queue for async processing
- **Redis** - Chat history storage

## 📊 API Endpoints

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/signin` - User login
- `POST /auth/refresh` - Refresh access token

### VPS Management
- `GET /vps` - List user's servers
- `POST /vps` - Create new server
- `GET /vps/:id` - Get server details
- `PUT /vps/:id/status` - Start/Stop server
- `DELETE /vps/:id` - Delete server

### AI Services
- `POST /ai/hardware-recommendation` - Get AI config recommendations
- `WS /ai/chat` - Real-time AI chat assistant

### Admin (requires admin role)
- `GET /admin/users` - List all users
- `GET /admin/containers` - List all containers
- `GET /admin/nodes` - List all nodes
- `POST /admin/nodes` - Create new node

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.

## 🧪 Testing

### API Testing
Use the Postman workspace or curl:

```bash
# Health check
curl http://localhost:8080/health

# Register user
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password","password_confirm":"password","name":"Test","surname":"User","phone":"+1234567890"}'
```

### Frontend Testing
```bash
cd frontend
npm run build  # Verify build succeeds
```

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Token refresh mechanism
- Role-based access control (RBAC)
- CORS configuration

## 📈 Monitoring

- Container metrics via WebSocket
- System-wide statistics in admin panel
- RabbitMQ queue monitoring
- PostgreSQL query logging

## 🚧 Production Deployment

1. Update CORS origins in backend
2. Use strong JWT secret
3. Configure SSL/TLS
4. Use production PostgreSQL
5. Implement rate limiting
6. Set up proper monitoring
7. Configure backups

See deployment guides in `deploy/` directory.

## 🤝 Contributing

This is a hackathon project. For issues or improvements:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

See [LICENSE](LICENSE) file.

## 👥 Team

LSBU Team - MTS x BSU Hackathon 2026

## 🙏 Acknowledgments

- MTS & BSU for organizing the hackathon
- Google for Gemini API
- Open source community for the amazing tools

---

**Built with ❤️ for the MTS x BSU Hackathon**