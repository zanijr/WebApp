#!/bin/bash

echo "🚀 Deploying latest changes to server..."

# Check if we're on the server
if [ ! -d "/home/zbonham/WebApp" ]; then
    echo "❌ This script must be run on the server (192.168.12.220)"
    echo "Please copy this script to your server and run it there."
    exit 1
fi

cd /home/zbonham/WebApp

echo "📋 Current git status:"
git status --short

echo ""
echo "📥 Pulling latest changes from GitHub..."
git stash
git pull origin main

echo ""
echo "📋 Current status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🛑 Stopping current containers..."
docker-compose down

echo ""
echo "🚀 Starting services with latest configuration..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo ""
echo "📋 Service status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔍 Testing configuration..."

# Test HTTP
echo "Testing HTTP (port 80):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/ || echo "HTTP test failed"

# Test HTTPS on 8444
echo "Testing HTTPS (port 8444):"
curl -s -k -o /dev/null -w "HTTPS Status: %{http_code}\n" https://localhost:8444/ || echo "HTTPS test failed"

echo ""
echo "📊 Nginx logs (last 10 lines):"
docker logs family_chores_nginx --tail 10

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app should now be accessible at:"
echo "   • http://family.bananas4life.com (port 80)"
echo "   • https://family.bananas4life.com:8444 (port 8444 - requires Cloudflare DNS-only mode)"
echo ""
echo "🔧 Remember: For port 8444 to work, you need to:"
echo "   1. Go to Cloudflare DNS settings"
echo "   2. Set 'family' record to DNS-only (gray cloud)"
echo "   3. Or use standard ports with Cloudflare proxy enabled"
