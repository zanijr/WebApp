# Family Chores App Deployment Instructions

## Step 1: Set up Cloudflare DNS

1. Log into your Cloudflare dashboard
2. Select the `bananas4life.com` domain
3. Go to **DNS** > **Records**
4. Click **Add record**
5. Set:
   - **Type**: A
   - **Name**: family
   - **IPv4 address**: 99.46.206.188
   - **Proxy status**: 🟠 Proxied (or DNS only if issues occur)
   - **TTL**: Auto

## Step 2: Deploy to Ubuntu Server

Since SSH from Windows is having authentication issues, here are alternative methods:

### Option A: Manual SSH (Recommended)
1. Use PuTTY or Windows Terminal to SSH to your server:
   - Host: `192.168.12.220` or `99.46.206.188`
   - Username: `zbonham`
   - Password: `J!mm!3M3m4N!`

2. Once connected, run these commands:

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

# Clone the repository
cd /home/zbonham
git clone https://github.com/zanijr/WebApp.git
cd WebApp

# Create uploads directory
mkdir -p uploads

# Start the application
docker-compose up -d --build

# Check status
docker-compose ps
docker-compose logs
```

### Option B: Use the Deployment Script
1. Copy the `deploy-to-server.sh` file to your Ubuntu server
2. Make it executable: `chmod +x deploy-to-server.sh`
3. Run it: `./deploy-to-server.sh`

## Step 3: Verify Deployment

After deployment, your app should be accessible at:
- **Internal**: http://192.168.12.220
- **External**: http://family.bananas4life.com:8080 (HTTP)
- **External**: https://family.bananas4life.com:8444 (HTTPS)

## Step 4: Test the Application

1. Open http://family.bananas4life.com:8080 in your browser
2. Click "Register here" to create a new family
3. Fill out the registration form
4. Note down the family code that's generated
5. Test logging in with the family code

## Troubleshooting

### If the app doesn't load:
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Check if ports are open
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

### If DNS doesn't resolve:
- Wait up to 24 hours for DNS propagation
- Try accessing directly via IP: http://99.46.206.188:8080
- Check Cloudflare DNS settings

### If registration fails:
```bash
# Check API logs
docker-compose logs family_chores_api

# Check database
docker exec family_chores_db mysql -u chores_user -pChoresPass123! family_chores -e "SHOW TABLES;"
```

## Security Notes

After deployment, consider:
1. Changing the default database passwords
2. Setting up SSL certificates with Let's Encrypt
3. Configuring a firewall (ufw)
4. Setting up SSH key authentication instead of password

## Support

If you encounter issues:
1. Check the container logs: `docker-compose logs`
2. Verify network connectivity: `ping family.bananas4life.com`
3. Test local access: `curl http://localhost/health`
