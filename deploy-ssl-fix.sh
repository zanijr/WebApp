#!/bin/bash

echo "🚀 Deploying SSL fix to server..."

SERVER_IP="192.168.12.220"
SERVER_USER="zbonham"
SERVER_PATH="/home/zbonham/WebApp"

echo "📁 Copying updated files to server..."

# Copy updated docker-compose.yml
echo "Copying docker-compose.yml..."
scp docker-compose.yml ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/

# Copy updated nginx configuration
echo "Copying nginx configuration..."
scp nginx/nginx.conf ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/nginx/

# Copy SSL fix script
echo "Copying SSL fix script..."
scp fix-ssl-8443.sh ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/

echo ""
echo "🔧 Running SSL fix on server..."
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_PATH} && chmod +x fix-ssl-8443.sh && ./fix-ssl-8443.sh"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Test your application:"
echo "   • http://family.bananas4life.com"
echo "   • https://family.bananas4life.com:8443"
