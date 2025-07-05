# 🚀 Server Deployment Instructions

## Quick Deployment to Server

All changes have been pushed to GitHub. Now deploy them to your server:

### Step 1: Connect to Your Server
```bash
ssh zbonham@192.168.12.220
```

### Step 2: Navigate to WebApp Directory and Pull Latest Changes
```bash
cd /home/zbonham/WebApp
git pull origin main
```

### Step 3: Run the Deployment Script
```bash
chmod +x deploy-latest-to-server.sh
./deploy-latest-to-server.sh
```

## What the Script Does:
1. ✅ Pulls latest changes from GitHub
2. ✅ Stops current Docker containers
3. ✅ Starts containers with updated configuration
4. ✅ Tests HTTP and HTTPS connectivity
5. ✅ Shows service status and logs

## Expected Output:
- HTTP Status: 200 (port 80)
- HTTPS Status: 200 (port 8444)
- All containers running properly

## After Deployment:
Your app will be accessible at:
- `http://family.bananas4life.com` (port 80)
- `https://family.bananas4life.com:8444` (port 8444)*

*For port 8444 to work through Cloudflare, you need to set the DNS record to "DNS only" (gray cloud) mode.

## Alternative: Use Standard Ports
For the best experience with Cloudflare:
- Keep Cloudflare proxy enabled (orange cloud)
- Access at: `https://family.bananas4life.com` (no port needed)

## Files Updated in This Deployment:
- `docker-compose.yml` - Port 8444 configuration
- `nginx/nginx.conf` - HTTPS server block for port 8444
- `fix-ssl-8444.sh` - SSL setup script
- `deploy-latest-to-server.sh` - This deployment script
- `FINAL_SOLUTION_PORT_8444.md` - Complete documentation

## Troubleshooting:
If you encounter issues, check:
1. Docker containers are running: `docker ps`
2. Nginx logs: `docker logs family_chores_nginx`
3. Cloudflare DNS settings (proxy vs DNS-only)

The server configuration is complete and ready for deployment!
