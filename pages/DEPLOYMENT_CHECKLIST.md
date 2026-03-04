# Deployment Checklist

## ✅ Pre-Deployment Verification

### Backend Services
- [ ] PostgreSQL running on port 5432
- [ ] Redis running on port 6379
- [ ] RabbitMQ running on ports 5672 and 15672
- [ ] Backend API running on port 8080
- [ ] AI Consult service consuming from `chat_requests` queue
- [ ] Recommendation service consuming from `hardware_requests` queue

### Environment Configuration
- [ ] `.env` file created with all required variables
- [ ] `GEMINI_API_KEY` configured
- [ ] `JWT_SECRET` set (use `openssl rand -base64 32`)
- [ ] Database credentials configured
- [ ] CORS origins updated for production domain

### Database Setup
- [ ] PostgreSQL initialized with schema from `deploy/init.sql`
- [ ] At least one node exists in `nodes` table
- [ ] Admin user created (role set to 'admin')
- [ ] Test user account created

### Frontend
- [ ] Dependencies installed (`npm install`)
- [ ] Build succeeds without errors (`npm run build`)
- [ ] API endpoint configured correctly in `src/api/axios.js`
- [ ] WebSocket URLs configured correctly

## 🧪 Functional Testing

### Authentication
- [ ] Can register new user
- [ ] Can login with username
- [ ] Can login with email
- [ ] Can login with phone
- [ ] Token refresh works on 401
- [ ] Logout clears tokens

### Server Management
- [ ] Dashboard loads server list
- [ ] Can create new server (all 3 steps)
- [ ] Server appears in dashboard after creation
- [ ] Can view server details
- [ ] Can start/stop server
- [ ] Can delete server
- [ ] Server status updates correctly

### AI Features
- [ ] AI chat opens and connects
- [ ] Can send messages to AI
- [ ] AI responds to messages
- [ ] Hardware recommendations work
- [ ] Can apply AI recommendations to config

### WebSocket Features
- [ ] Terminal connects successfully
- [ ] Can execute commands in terminal
- [ ] Terminal output displays correctly
- [ ] Metrics stream connects (if implemented)

### Port Management
- [ ] Can add port mapping
- [ ] Port mappings list displays
- [ ] Can delete port mapping

### Profile Management
- [ ] Can view user info
- [ ] Can update personal data
- [ ] Can change password
- [ ] Can view balance
- [ ] Can add to balance

### Admin Panel (with admin role)
- [ ] Can access admin users page
- [ ] Can search users
- [ ] Can access admin containers page
- [ ] Can view container statistics
- [ ] Can access admin nodes page
- [ ] Can create new node
- [ ] Can delete node

## 🔒 Security Checks

- [ ] JWT tokens have reasonable expiration
- [ ] Passwords are hashed (bcrypt)
- [ ] Admin routes require admin role
- [ ] CORS properly configured
- [ ] No sensitive data in frontend code
- [ ] Environment variables not committed
- [ ] SQL injection protection (GORM)
- [ ] XSS protection (React)

## 🚀 Performance Checks

- [ ] Frontend bundle size acceptable (~313 KB)
- [ ] API response times < 200ms
- [ ] WebSocket latency acceptable
- [ ] Database queries optimized
- [ ] Images optimized (if any)
- [ ] No console errors in browser

## 📱 Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

## 📊 Monitoring Setup

- [ ] Application logs configured
- [ ] Error tracking setup
- [ ] RabbitMQ queues monitored
- [ ] Database connection pool monitored
- [ ] WebSocket connections monitored

## 🔄 Deployment Steps

### 1. Backend Deployment
```bash
# Build backend
cd backend/api
go build -o iaas-api cmd/api/main.go

# Run with environment
./iaas-api
```

### 2. Frontend Deployment
```bash
# Build frontend
cd frontend
npm run build

# Serve static files
# Option 1: Using a static server
npx serve -s dist

# Option 2: Using nginx
# Copy dist/ to nginx html directory
```

### 3. AI Services Deployment
```bash
# Deploy AI Consult
cd ai-consult-service
python consumer.py &

# Deploy Recommendation Service
cd recommendation-service
python consumer.py &
```

### 4. Docker Deployment (Recommended)
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify database credentials
- Check port 8080 is available
- Review logs for errors

### Frontend build fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (18+)
- Review error messages

### WebSocket connection fails
- Ensure backend WebSocket endpoints working
- Check CORS allows WebSocket upgrades
- Verify token is valid
- Check browser console for errors

### AI services not responding
- Verify RabbitMQ is running
- Check Gemini API key is valid
- Review Python service logs
- Ensure queues exist in RabbitMQ

## 📝 Post-Deployment

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Test with real users
- [ ] Set up automated backups
- [ ] Configure monitoring alerts
- [ ] Document any issues found

## 🎉 Success Criteria

The deployment is successful when:
1. All services are running without errors
2. Users can register and login
3. Users can create and manage servers
4. AI features respond correctly
5. WebSocket connections work
6. Admin panel accessible
7. No critical errors in logs

---

**Last Updated:** 2026-03-04
