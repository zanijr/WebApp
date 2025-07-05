# 🚀 DEPLOY YOUR FAMILY CHORES APP NOW

## Quick Deployment Guide

Since we're having SSH automation issues, here's the exact step-by-step process to get your app live:

### Step 1: Connect to Your Ubuntu Server
1. Open **Windows Terminal** or **PuTTY**
2. Connect to your server:
   ```
   ssh zbonham@192.168.12.220
   ```
   Password: `J!mm!3M3m4N!`

### Step 2: Install Docker (Copy and paste these commands one by one)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for Docker group to take effect
exit
```

### Step 3: Reconnect and Deploy App

```bash
# Reconnect to server
ssh zbonham@192.168.12.220

# Clone your app
cd /home/zbonham
git clone https://github.com/zanijr/WebApp.git
cd WebApp

# Create uploads directory
mkdir -p uploads

# Start the application
docker-compose up -d --build

# Wait 30 seconds for everything to start
sleep 30

# Check if everything is running
docker-compose ps
```

### Step 4: Verify Deployment

```bash
# Test local access
curl http://localhost/health

# Check logs
docker-compose logs --tail=20

# If there are issues, restart
docker-compose restart
```

### Step 5: Set up Cloudflare DNS

1. Go to Cloudflare dashboard
2. Select `bananas4life.com`
3. DNS > Records > Add record:
   - Type: **A**
   - Name: **family**
   - IPv4: **99.46.206.188**
   - Proxy: **🟠 Proxied**

### Step 6: Test Your App

After DNS propagates (5-30 minutes), visit:
- **http://family.bananas4life.com:8080**

## Troubleshooting Commands

If something goes wrong:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs

# Restart everything
docker-compose down
docker-compose up -d --build

# Check if ports are open
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000

# Check disk space
df -h

# Check memory
free -h
```

## Expected Results

After successful deployment:
1. ✅ 3 containers running (nginx, api, database)
2. ✅ App accessible at http://192.168.12.220 locally
3. ✅ App accessible at http://family.bananas4life.com:8080 externally
4. ✅ Family registration working
5. ✅ Database storing data

## What to Do After Deployment

1. **Test the app**: Register a new family and create some chores
2. **Share with family**: Give them the URL and family code
3. **Monitor**: Check `docker-compose logs` occasionally
4. **Backup**: Consider backing up the database regularly

## Need Help?

If you encounter any issues:
1. Run `docker-compose logs` and check for errors
2. Ensure ports 8080 and 8444 are forwarded correctly
3. Verify Cloudflare DNS settings
4. Check that the server has enough disk space and memory

---

**Your app is ready to deploy! Follow these steps and your family will be able to access the Family Chores app within 30 minutes.**
