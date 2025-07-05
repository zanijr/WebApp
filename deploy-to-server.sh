#!/bin/bash

# Family Chores App Deployment Script
# Run this script on your Ubuntu server (192.168.12.220)

echo "=== Family Chores App Deployment ==="
echo "Starting deployment to Ubuntu server..."

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "Docker is already installed"
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose is already installed"
fi

# Create application directory
echo "Setting up application directory..."
cd /home/zbonham
if [ -d "WebApp" ]; then
    echo "Updating existing application..."
    cd WebApp
    git pull origin main
else
    echo "Cloning application repository..."
    git clone https://github.com/zanijr/WebApp.git
    cd WebApp
fi

# Create uploads directory
mkdir -p uploads

# Stop existing containers if running
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Build and start the application
echo "Building and starting the application..."
docker-compose up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Check container status
echo "Checking container status..."
docker-compose ps

# Test the application
echo "Testing application health..."
curl -f http://localhost/health || echo "Health check failed"

# Show logs
echo "Recent application logs:"
docker-compose logs --tail=20

echo ""
echo "=== Deployment Complete ==="
echo "Your Family Chores app should now be running on:"
echo "- Local: http://192.168.12.220"
echo "- External: http://family.bananas4life.com:8080"
echo ""
echo "To check logs: docker-compose logs -f"
echo "To restart: docker-compose restart"
echo "To stop: docker-compose down"
