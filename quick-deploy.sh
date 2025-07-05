#!/bin/bash

# Quick Deployment Script for Family Chores App
# Run this on your Ubuntu server at 192.168.12.220

set -e  # Exit on any error

echo "🚀 Family Chores App - Quick Deployment"
echo "========================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as user 'zbonham'"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update -y

# Install Git if needed
if ! command -v git &> /dev/null; then
    echo "📥 Installing Git..."
    sudo apt install git -y
fi

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "⚠️  Docker installed. You may need to log out and back in for group changes to take effect."
fi

# Install Docker Compose if needed
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Navigate to home directory
cd /home/zbonham

# Stop any existing application
if [ -d "WebApp" ]; then
    echo "🛑 Stopping existing application..."
    cd WebApp
    docker-compose down 2>/dev/null || true
    cd ..
fi

# Remove old installation
echo "🗑️  Removing old installation..."
sudo rm -rf WebApp

# Clone fresh copy
echo "📥 Downloading latest application..."
git clone https://github.com/zanijr/WebApp.git
cd WebApp

# Create directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p frontend/uploads

# Set permissions
echo "🔐 Setting permissions..."
sudo chown -R zbonham:zbonham /home/zbonham/WebApp
chmod -R 755 /home/zbonham/WebApp

# Build and start
echo "🏗️  Building and starting application..."
docker-compose up -d --build

# Wait for startup
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "🔍 Checking application status..."
docker-compose ps

# Test health
echo "🏥 Testing application health..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed, but application may still be starting..."
fi

# Test main page
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Main page accessible!"
else
    echo "⚠️  Main page not accessible yet..."
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "Your Family Chores app is now running at:"
echo "🌐 http://192.168.12.220"
echo ""
echo "Next steps:"
echo "1. Open http://192.168.12.220 in your browser"
echo "2. Click 'Register here' to create your family"
echo "3. Save the family code that's generated"
echo ""
echo "Useful commands:"
echo "📊 Check status: docker-compose ps"
echo "📋 View logs: docker-compose logs -f"
echo "🔄 Restart: docker-compose restart"
echo "🛑 Stop: docker-compose down"
echo ""
echo "If you encounter issues, check the logs with:"
echo "docker-compose logs"
