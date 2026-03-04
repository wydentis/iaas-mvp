# Quick Start Guide - IaaS MVP Frontend

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Backend running on `http://localhost:8080`
- Backend must have at least one user and one node configured

### Installation

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Open browser to: http://localhost:5173

## 📋 First Time Setup

### 1. Create Account
- Navigate to http://localhost:5173/register
- Fill in all fields:
  - Username
  - Name & Surname
  - Email
  - Phone
  - Password
- Click "Зарегистрироваться"

### 2. Create First Server
- Click "+ Создать сервер"
- **Step 1 - OS Selection:**
  - Select Ubuntu, Debian, CentOS, etc.
  - Choose version from dropdown
  - Click "Далее: Регион"
- **Step 2 - Region:**
  - Select available node/region
  - Click "Далее: Конфигурация"
- **Step 3 - Configuration:**
  - Adjust CPU, RAM, Disk sliders
  - Optional: Click "Спросить у ИИ рекомендацию" for AI suggestions
  - Toggle Backup/Public IP if needed
  - Review pricing on the right sidebar
  - Click "Заказать"

### 3. Manage Server
- Click on server card from dashboard
- **Dashboard Tab:** View metrics and IP information
- **Console Tab:** Connect to terminal via WebSocket
- **Network Tab:** Manage port mappings
- Use action buttons to:
  - ▶ Start server
  - ⏸ Stop server
  - ⚙ Resize configuration
  - 🗑 Delete server

### 4. Use AI Chat
- Click the floating "💬 Спросить у ИИ" button (bottom right)
- Ask questions about server configurations
- Chat history is maintained (last 20 messages, 24h)

### 5. Manage Profile
- Click username dropdown (top right)
- Select "Профиль"
- Edit personal data, login, or password
- Top up balance

## 🔐 Admin Panel Access

### Setup Admin User
You need to manually set user role to 'admin' in database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

### Access Admin Features
Once admin role is set:
- Username dropdown → "Пользователи" (users list)
- Username dropdown → "Контейнеры" (all containers)
- Username dropdown → "Ноды" (node management)

### Admin Features
- **Users:** Search and view all users
- **Containers:** Monitor all VPS across system
- **Nodes:** Create/delete nodes, view statistics

## 🎨 UI Overview

### Color Scheme
- Primary: #c41e3a (Red)
- Background: #f5f5f5 (Light gray)
- Cards: #ffffff (White)
- Text: #333333 (Dark gray)

### Key UI Elements
- **Header:** Logo, balance, user menu
- **Cards:** Server instances, configuration options
- **Tabs:** Multi-section pages (server details, admin)
- **Modals:** Forms and confirmations
- **Badges:** Status indicators (running, stopped, etc.)

## 🔧 Configuration

### API Endpoint
Default: `http://localhost:8080`

To change, edit `/frontend/src/api/axios.js`:
```javascript
const api = axios.create({
  baseURL: 'http://your-backend-url:port',
});
```

### WebSocket Endpoint
Default: `ws://localhost:8080`

To change, update WebSocket URLs in:
- `src/components/common/AIChat.jsx`
- `src/pages/Servers/ServerDetails.jsx`

## 📱 Features Walkthrough

### Balance System
- Displayed in header (₽ currency)
- Shows estimated days remaining
- Top up via Profile page
- Consumed based on server configurations

### Pricing
Calculated per hour/day/month:
- CPU: 0.48 ₽/core
- RAM: 0.25 ₽/GB
- Disk: 0.05 ₽/50GB
- Additional: Backup, Public IP, NVMe

### Server States
- 🟢 **RUNNING** - Active and accessible
- ⚪ **STOPPED** - Powered off
- 🟡 **PENDING** - Being created
- 🔴 **ERROR** - Failed state

## 🐛 Troubleshooting

### "Failed to load servers"
- Ensure backend is running
- Check JWT token is valid
- Verify network connection to backend

### "WebSocket connection failed"
- Backend WebSocket endpoints must be accessible
- CORS must allow WebSocket upgrades
- Check browser console for specific errors

### "AI recommendations not loading"
- Gemini API key must be configured on backend
- RabbitMQ must be running
- Python recommendation service must be active

### Build errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## 📦 Production Deployment

### Build for Production
```bash
npm run build
```

Output directory: `dist/`

### Serve Static Files
```bash
npm run preview
```

Or use any static file server:
```bash
# Using serve
npx serve -s dist

# Using nginx
# Copy dist/ contents to nginx html folder
```

### Environment Variables
For production, consider:
- Setting API URL via environment variable
- Enabling HTTPS
- Using httpOnly cookies instead of localStorage for tokens
- Implementing rate limiting on backend

## 📚 Code Organization

```
src/
├── api/           # API client configuration
├── components/    # Reusable UI components
├── contexts/      # React contexts (Auth)
├── pages/         # Page components
├── utils/         # Utilities (pricing, websocket)
├── App.jsx        # Main app with routing
└── main.jsx       # Entry point
```

## 🎯 Test Scenarios

### User Flow
1. Register new account
2. Add balance (500₽)
3. Create Ubuntu server (2 CPU, 2GB RAM)
4. Wait for RUNNING status
5. Open server details
6. Connect to terminal
7. Run commands: `ls`, `pwd`, `uname -a`
8. Add port mapping (80 → 8080)
9. Stop server
10. Start server again

### Admin Flow
1. Login as admin
2. Navigate to Nodes
3. Create new node
4. Navigate to Containers
5. View all user containers
6. Navigate to Users
7. Search for specific user

## 💡 Tips

- Use AI chat for configuration advice
- Check pricing before creating large servers
- Monitor balance regularly
- Use port mappings for web applications
- Leverage AI recommendations for optimal configs
- Admin panel provides full system visibility

## 🔗 Resources

- Backend API: http://localhost:8080
- Frontend Dev: http://localhost:5173
- RabbitMQ Management: http://localhost:15672
- API Documentation: See API_DOCUMENTATION.md

## ✅ Verification Checklist

- [ ] Backend running on port 8080
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Can register new account
- [ ] Can login with credentials
- [ ] Can see server dashboard
- [ ] Can create new server
- [ ] Can view server details
- [ ] WebSocket terminal works
- [ ] AI chat responds
- [ ] Admin panel accessible (if admin role set)

---

**Ready to go!** 🎉

For issues or questions, check the main README.md and API_DOCUMENTATION.md files.
