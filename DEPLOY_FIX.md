# 🔧 DEPLOYMENT FIX - Network Issues

## Problem: Cannot resolve github.com

Your Ubuntu server cannot access the internet or resolve DNS. Let's fix this:

### Step 1: Check Network Connectivity

```bash
# Test internet connectivity
ping 8.8.8.8

# Test DNS resolution
nslookup github.com
nslookup google.com

# Check DNS configuration
cat /etc/resolv.conf
```

### Step 2: Fix DNS (if needed)

If DNS is not working, add Google DNS:

```bash
# Backup current DNS config
sudo cp /etc/resolv.conf /etc/resolv.conf.backup

# Add Google DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
echo "nameserver 8.8.4.4" | sudo tee -a /etc/resolv.conf

# Test again
nslookup github.com
```

### Step 3: Alternative - Transfer Files Manually

If internet access is still not working, we can transfer the files directly:

#### Option A: Use SCP from Windows

From your Windows machine:

```cmd
# Create a zip of the project
powershell Compress-Archive -Path . -DestinationPath WebApp.zip

# Transfer to server (you'll need pscp or WinSCP)
scp WebApp.zip zbonham@192.168.12.220:/home/zbonham/
```

#### Option B: Use USB/Network Share

1. Copy the entire WebApp folder to a USB drive
2. Mount the USB on the Ubuntu server
3. Copy files to `/home/zbonham/WebApp`

### Step 4: Deploy Without Git

Once files are on the server:

```bash
# If you used zip file
cd /home/zbonham
unzip WebApp.zip
cd WebApp

# Or if you copied the folder directly
cd /home/zbonham/WebApp

# Install Docker (if internet works now)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again
exit
```

### Step 5: Reconnect and Deploy

```bash
# Reconnect
ssh zbonham@192.168.12.220

# Go to app directory
cd /home/zbonham/WebApp

# Create uploads directory
mkdir -p uploads

# Start the application
docker-compose up -d --build

# Check status
docker-compose ps
docker-compose logs
```

### Step 6: Test Local Access

```bash
# Test if the app is running locally
curl http://localhost/health
curl http://192.168.12.220/health

# Check what's listening on port 80
sudo netstat -tlnp | grep :80
```

## Troubleshooting Network Issues

### Check Network Interface

```bash
# Check network interfaces
ip addr show

# Check routing
ip route show

# Check if gateway is reachable
ping $(ip route | grep default | awk '{print $3}')
```

### Check Firewall

```bash
# Check if firewall is blocking
sudo ufw status

# If firewall is active, allow necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
```

### Check Internet Access

```bash
# Try different DNS servers
echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

# Test connectivity
wget -q --spider http://google.com
echo $?  # Should return 0 if successful
```

## Alternative: Manual Docker Installation

If you can't download Docker from the internet, you can:

1. Download Docker .deb packages on a machine with internet
2. Transfer them to the Ubuntu server
3. Install manually with `sudo dpkg -i package.deb`

## Next Steps

1. **Fix network connectivity first**
2. **Transfer files to server** (via git or manual copy)
3. **Install Docker and Docker Compose**
4. **Deploy the application**
5. **Test local access**
6. **Configure external access**

Let me know which step you're stuck on and I'll provide more specific guidance!
