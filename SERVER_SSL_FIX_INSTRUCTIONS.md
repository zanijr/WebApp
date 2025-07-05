# 🔧 SSL Fix Instructions for Server

## Quick Fix for family.bananas4life.com:8443 SSL Error

The SSL handshake error (Error 525) occurs because your server doesn't have HTTPS configured on port 8443. Here's how to fix it:

### Step 1: Pull Latest Changes
```bash
cd /home/zbonham/WebApp
git pull origin main
```

### Step 2: Run the SSL Fix Script
```bash
chmod +x fix-ssl-8443.sh
./fix-ssl-8443.sh
```

### What the Script Does:
1. ✅ Stops current containers
2. ✅ Creates self-signed SSL certificates
3. ✅ Updates docker-compose to expose port 8443
4. ✅ Configures nginx with HTTPS on port 8443
5. ✅ Restarts all services with SSL support
6. ✅ Tests the configuration

### Expected Result:
- ✅ `http://family.bananas4life.com` (port 80)
- ✅ `https://family.bananas4life.com:8443` (port 8443)

### If You Still Get SSL Errors:
Check your Cloudflare settings:
1. Go to https://dash.cloudflare.com
2. Select `bananas4life.com` domain
3. Go to **SSL/TLS > Overview**
4. Set encryption mode to **"Full"** or **"Full (strict)"**
5. Go to **SSL/TLS > Edge Certificates**
6. Enable **"Always Use HTTPS"**

### Alternative: Use Standard Ports (Recommended)
If you prefer to use standard ports instead of 8443:
1. Update your Cloudflare DNS record for `family` to point to `192.168.12.220`
2. Set proxy status to **🟠 Proxied** (orange cloud)
3. Access your app at `https://family.bananas4life.com` (no port needed)

---

## Files Updated:
- `docker-compose.yml` - Added port 8443 exposure
- `nginx/nginx.conf` - Added HTTPS server block for port 8443
- `fix-ssl-8443.sh` - SSL setup and deployment script

## Quick Test Commands:
```bash
# Test HTTP
curl -I http://localhost/

# Test HTTPS on 8443
curl -k -I https://localhost:8443/

# Check container status
docker ps

# View nginx logs
docker logs family_chores_nginx
