# 🔧 SSL Fix Instructions for Port 8444

## Quick Fix for family.bananas4life.com:8444 SSL Error

The SSL handshake error (Error 525) occurs because your server doesn't have HTTPS configured on port 8444. Here's how to fix it:

### Step 1: Pull Latest Changes
```bash
cd /home/zbonham/WebApp
git stash
git pull origin main
```

### Step 2: Run the SSL Fix Script for Port 8444
```bash
chmod +x fix-ssl-8444.sh
./fix-ssl-8444.sh
```

### What the Script Does:
1. ✅ Stops current containers
2. ✅ Creates self-signed SSL certificates
3. ✅ Updates docker-compose to expose port 8444
4. ✅ Configures nginx with HTTPS on port 8444
5. ✅ Restarts all services with SSL support
6. ✅ Tests the configuration

### Expected Result:
- ✅ `http://family.bananas4life.com` (port 80)
- ✅ `https://family.bananas4life.com:8444` (port 8444)

### If You Still Get SSL Errors:
Check your Cloudflare settings:
1. Go to https://dash.cloudflare.com
2. Select `bananas4life.com` domain
3. Go to **SSL/TLS > Overview**
4. Set encryption mode to **"Full"** or **"Full (strict)"**
5. Go to **SSL/TLS > Edge Certificates**
6. Enable **"Always Use HTTPS"**

### Alternative: Use Standard Ports (Recommended)
If you prefer to use standard ports instead of 8444:
1. Update your Cloudflare DNS record for `family` to point to `192.168.12.220`
2. Set proxy status to **🟠 Proxied** (orange cloud)
3. Access your app at `https://family.bananas4life.com` (no port needed)

---

## Files Updated:
- `docker-compose.yml` - Added port 8444 exposure
- `nginx/nginx.conf` - Added HTTPS server block for port 8444
- `fix-ssl-8444.sh` - SSL setup and deployment script

## Quick Test Commands:
```bash
# Test HTTP
curl -I http://localhost/

# Test HTTPS on 8444
curl -k -I https://localhost:8444/

# Check container status
docker ps

# View nginx logs
docker logs family_chores_nginx
```

## Note about Cloudflare Port Support:
Port 8444 is **NOT** in Cloudflare's standard supported ports list. For best results:
- Use standard ports (80/443) with Cloudflare proxy enabled
- Or disable Cloudflare proxy (gray cloud) to use port 8444 directly
