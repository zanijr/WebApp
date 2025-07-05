# Family Chores App - Server Deployment Guide
## Deploy to 192.168.12.220

### Prerequisites
- Ubuntu server at 192.168.12.220
- SSH access with username: zbonham
- Internet connection for downloading Docker and dependencies

### Step 1: Connect to Your Server

Use one of these methods to connect to your server:

**Option A: Windows Terminal/PowerShell**
```powershell
ssh zbonham@192.168.12.220
```

**Option B: PuTTY**
- Host: 192.168.12.220
- Username: zbonham
- Port: 22

### Step 2: Install Dependencies

Once connected to your server, run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Git if not already installed
sudo apt install git -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in to apply Docker group changes
exit
```

### Step 3: Deploy the Application

SSH back into your server and run:

```bash
# Navigate to home directory
cd /home/zbonham

# Remove any existing WebApp directory
sudo rm -rf WebApp

# Clone the latest version from GitHub
git clone https://github.com/zanijr/WebApp.git
cd WebApp

# Create necessary directories
mkdir -p uploads
mkdir -p frontend/uploads

# Set proper permissions
sudo chown -R zbonham:zbonham /home/zbonham/WebApp
chmod -R 755 /home/zbonham/WebApp

# Stop any existing containers
docker-compose down 2>/dev/null || true

# Build and start the application
docker-compose up -d --build

# Wait for services to initialize
sleep 30

# Check container status
docker-compose ps
```

### Step 4: Verify Deployment

Check if all containers are running:

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs --tail=20

# Test health endpoint
curl -f http://localhost/health

# Test the main application
curl -f http://localhost/
```

### Step 5: Access Your Application

Your Family Chores app should now be accessible at:

- **Local Network**: http://192.168.12.220
- **External (if configured)**: http://family.bananas4life.com:8080

### Step 6: Create Your First Family

1. Open http://192.168.12.220 in your web browser
2. Click "Don't have a family code? Register here"
3. Fill out the family registration form:
   - Family Name: Your family name
   - Admin Email: Your email address
4. Click "Register Family"
5. **IMPORTANT**: Save the family code that's generated - you'll need it to log in!

### Troubleshooting

#### If containers won't start:
```bash
# Check Docker service
sudo systemctl status docker
sudo systemctl start docker

# Check for port conflicts
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :3306

# Restart the application
cd /home/zbonham/WebApp
docker-compose down
docker-compose up -d --build
```

#### If the database won't connect:
```bash
# Check database container
docker-compose logs family_chores_db

# Reset database if needed
docker-compose down
docker volume rm webapp_mysql_data
docker-compose up -d --build
```

#### If you get permission errors:
```bash
# Fix ownership
sudo chown -R zbonham:zbonham /home/zbonham/WebApp
chmod -R 755 /home/zbonham/WebApp

# Fix Docker permissions
sudo usermod -aG docker zbonham
# Log out and back in
```

### Maintenance Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Update application
cd /home/zbonham/WebApp
git pull origin main
docker-compose down
docker-compose up -d --build

# Backup database
docker exec family_chores_db mysqldump -u chores_user -pChoresPass123! family_chores > backup.sql
```

### Security Recommendations

After deployment, consider:

1. **Change default passwords** in docker-compose.yml
2. **Set up firewall**:
   ```bash
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   ```
3. **Set up SSL** with Let's Encrypt (optional)
4. **Regular backups** of the database

### Support

If you encounter issues:
1. Check container logs: `docker-compose logs`
2. Verify network connectivity: `ping google.com`
3. Test local access: `curl http://localhost/health`
4. Check system resources: `df -h` and `free -m`

---

**Deployment completed successfully when:**
- All containers show "Up" status in `docker-compose ps`
- Health check returns HTTP 200: `curl http://localhost/health`
- Main page loads: `curl http://localhost/`
- You can access the app in your browser at http://192.168.12.220
