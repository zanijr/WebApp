# 🔧 TROUBLESHOOTING - What's Not Working?

Let's diagnose the exact issue. Please run these commands on your Ubuntu server and share the output:

## Step 1: Check Current Status

```bash
# Where are you currently?
pwd
ls -la

# Are you in the WebApp directory?
cd /home/zbonham/WebApp
ls -la
```

## Step 2: Check Docker Installation

```bash
# Is Docker installed?
docker --version

# Is Docker running?
sudo systemctl status docker

# Can you run Docker without sudo?
docker ps

# If Docker requires sudo, you need to logout/login again
```

## Step 3: Check Docker Compose

```bash
# Is Docker Compose installed?
docker-compose --version

# Try to see what containers exist
docker-compose ps

# Check if any containers are running
docker ps -a
```

## Step 4: Try to Start the Application

```bash
# Make sure you're in the right directory
cd /home/zbonham/WebApp

# Try to start the application
docker-compose up -d --build

# Check what happened
docker-compose ps
docker-compose logs
```

## Step 5: Check Network Access

```bash
# Test local access
curl http://localhost
curl http://localhost/health
curl http://192.168.12.220

# Check what's listening on ports
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000
```

## Step 6: Check File Permissions

```bash
# Check if files are readable
ls -la /home/zbonham/WebApp/
ls -la /home/zbonham/WebApp/docker-compose.yml
cat /home/zbonham/WebApp/docker-compose.yml
```

## Common Issues & Solutions

### Issue 1: Docker not installed
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Then logout and login again
```

### Issue 2: Docker Compose not installed
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Issue 3: Permission denied
```bash
# You need to logout and login after adding user to docker group
exit
# Then reconnect: ssh zbonham@192.168.12.220
```

### Issue 4: Port already in use
```bash
# Check what's using port 80
sudo lsof -i :80
sudo lsof -i :3000

# Kill conflicting processes if needed
sudo pkill -f nginx
sudo pkill -f apache
```

### Issue 5: Not enough disk space
```bash
# Check disk space
df -h

# Clean up if needed
docker system prune -a
```

### Issue 6: Memory issues
```bash
# Check memory
free -h

# Check system load
top
```

## Please Share This Information:

1. **What specific error message are you seeing?**
2. **At which step does it fail?**
3. **Output of these commands:**
   ```bash
   pwd
   ls -la
   docker --version
   docker-compose --version
   docker ps
   curl http://localhost
   ```

## Quick Reset (if needed)

If everything is broken, start fresh:

```bash
# Stop everything
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Remove the directory and start over
cd /home/zbonham
rm -rf WebApp
git clone https://github.com/zanijr/WebApp.git
cd WebApp
docker-compose up -d --build
```

Let me know exactly what error you're seeing and I'll provide a specific solution!
