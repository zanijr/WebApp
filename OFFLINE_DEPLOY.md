# 🔧 OFFLINE DEPLOYMENT - No Internet Package Access

I can see that your server can access GitHub but not Ubuntu package repositories (`us.archive.ubuntu.com`). Let's deploy without installing docker-compose from apt.

## 🎯 Problem Identified:
- ✅ GitHub access works (git clone succeeded)
- ❌ Ubuntu package repositories unreachable
- ❌ Cannot install docker-compose via apt

## 🚀 SOLUTION: Manual Docker Compose Installation

Run these commands on your Ubuntu server:

```bash
# Step 1: Download Docker Compose directly from GitHub
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Step 2: Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Step 3: Verify installation
docker-compose --version

# Step 4: Go to app directory
cd WebApp

# Step 5: Create uploads directory
mkdir -p uploads

# Step 6: Start the application
docker-compose up -d --build

# Step 7: Wait for containers to start (this takes 3-5 minutes)
sleep 300

# Step 8: Check container status
docker-compose ps

# Step 9: Check logs
docker-compose logs --tail=20

# Step 10: Test the application
curl http://localhost
curl http://localhost/health
```

## 🔍 If Docker Compose Download Fails:

If GitHub access also fails for docker-compose, we'll use Docker directly:

```bash
# Alternative: Use docker directly instead of docker-compose
cd WebApp

# Create network
docker network create family_chores_network

# Start MySQL database
docker run -d \
  --name family_chores_db \
  --network family_chores_network \
  -e MYSQL_ROOT_PASSWORD=RootPass123! \
  -e MYSQL_DATABASE=family_chores \
  -e MYSQL_USER=chores_user \
  -e MYSQL_PASSWORD=ChoresPass123! \
  -p 3306:3306 \
  mysql:8.0

# Wait for database to start
sleep 60

# Build and start API
docker build -t webapp-api ./api
docker run -d \
  --name family_chores_api \
  --network family_chores_network \
  -e NODE_ENV=production \
  -e DB_HOST=family_chores_db \
  -e DB_USER=chores_user \
  -e DB_PASSWORD=ChoresPass123! \
  -e DB_NAME=family_chores \
  -e JWT_SECRET=your-super-secret-jwt-key-change-this-in-production \
  -p 3000:3000 \
  webapp-api

# Start Nginx
docker run -d \
  --name family_chores_nginx \
  --network family_chores_network \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf \
  -v $(pwd)/frontend:/usr/share/nginx/html \
  nginx:alpine

# Check if containers are running
docker ps

# Test the application
curl http://localhost
```

## 🎯 Expected Results:

After running either method, you should see:

1. **Docker Compose method**: 3 containers with names like `family_chores_*`
2. **Direct Docker method**: 3 containers named exactly as specified above
3. **curl http://localhost** returns HTML content starting with `<!DOCTYPE html>`

## 🌐 Test Your App:

```bash
# Test local access
curl http://localhost
curl http://192.168.12.220

# If successful, open in browser:
# http://192.168.12.220
```

## 🔧 Troubleshooting:

### If containers won't start:
```bash
# Check Docker daemon
sudo systemctl status docker
sudo systemctl start docker

# Check logs
docker logs family_chores_db
docker logs family_chores_api
docker logs family_chores_nginx
```

### If ports are in use:
```bash
# Check what's using port 80
sudo lsof -i :80
sudo pkill -f apache2
sudo pkill -f nginx
```

## 🎉 Success Indicators:

1. ✅ `docker-compose --version` OR `docker ps` shows 3 running containers
2. ✅ `curl http://localhost` returns HTML content
3. ✅ Browser shows Family Chores login page at http://192.168.12.220

## 📱 After Success:

1. **Set up Cloudflare DNS**: Add A record `family` → `99.46.206.188`
2. **Test external access**: http://family.bananas4life.com:8080
3. **Register your family**: Click "Register here" on the login page

Try the Docker Compose method first, then fall back to direct Docker commands if needed!
