#!/bin/bash

echo "🔧 Fixing SSL configuration for port 8443..."

# Check if we're on the server
if [ ! -d "/home/zbonham/WebApp" ]; then
    echo "❌ This script must be run on the server (192.168.12.220)"
    echo "Please copy this script to your server and run it there."
    exit 1
fi

cd /home/zbonham/WebApp

echo "📋 Current status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🛑 Stopping current containers..."
docker-compose down

echo ""
echo "🔐 Setting up SSL certificates in nginx container..."

# Create a temporary container to set up SSL certificates
echo "Creating temporary nginx container to set up SSL..."
docker run --rm -d --name temp_nginx nginx:alpine sleep 60

# Install openssl and create self-signed certificates
docker exec temp_nginx sh -c "
    apk add --no-cache openssl && \
    mkdir -p /etc/ssl/certs /etc/ssl/private && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/ssl-cert-snakeoil.key \
        -out /etc/ssl/certs/ssl-cert-snakeoil.pem \
        -subj '/C=US/ST=State/L=City/O=Organization/CN=family.bananas4life.com' && \
    chmod 600 /etc/ssl/private/ssl-cert-snakeoil.key && \
    chmod 644 /etc/ssl/certs/ssl-cert-snakeoil.pem
"

# Copy certificates to host
echo "Copying SSL certificates to host..."
mkdir -p ./ssl
docker cp temp_nginx:/etc/ssl/certs/ssl-cert-snakeoil.pem ./ssl/
docker cp temp_nginx:/etc/ssl/private/ssl-cert-snakeoil.key ./ssl/

# Stop temporary container
docker stop temp_nginx

echo ""
echo "📝 Updating docker-compose to mount SSL certificates..."

# Create updated docker-compose with SSL volume mounts
cat > docker-compose-ssl.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: family_chores_db
    environment:
      MYSQL_ROOT_PASSWORD: FamilyChores2025!
      MYSQL_DATABASE: family_chores
      MYSQL_USER: chores_user
      MYSQL_PASSWORD: ChoresPass123!
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    restart: unless-stopped
    networks:
      - family_chores_network

  api:
    build: ./api
    container_name: family_chores_api
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: chores_user
      DB_PASSWORD: ChoresPass123!
      DB_NAME: family_chores
      JWT_SECRET: FamilyChoresJWT2025SecretKey!
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: AdminPass123!
      SERVER_IP: 192.168.12.220
    ports:
      - "3000:3000"
    depends_on:
      - mysql
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads
    networks:
      - family_chores_network

  nginx:
    image: nginx:alpine
    container_name: family_chores_nginx
    ports:
      - "80:80"
      - "443:443"
      - "8443:8443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./frontend:/usr/share/nginx/html
      - ./uploads:/usr/share/nginx/html/uploads
      - ./ssl/ssl-cert-snakeoil.pem:/etc/ssl/certs/ssl-cert-snakeoil.pem:ro
      - ./ssl/ssl-cert-snakeoil.key:/etc/ssl/private/ssl-cert-snakeoil.key:ro
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - family_chores_network

volumes:
  mysql_data:

networks:
  family_chores_network:
    driver: bridge
EOF

echo ""
echo "🚀 Starting services with SSL support..."
docker-compose -f docker-compose-ssl.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "📋 Service status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔍 Testing SSL configuration..."

# Test HTTP
echo "Testing HTTP (port 80):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/ || echo "HTTP test failed"

# Test HTTPS on 8443
echo "Testing HTTPS (port 8443):"
curl -s -k -o /dev/null -w "HTTPS Status: %{http_code}\n" https://localhost:8443/ || echo "HTTPS test failed"

echo ""
echo "📊 Nginx logs (last 10 lines):"
docker logs family_chores_nginx --tail 10

echo ""
echo "✅ SSL configuration complete!"
echo ""
echo "🌐 Your app should now be accessible at:"
echo "   • http://family.bananas4life.com (port 80)"
echo "   • https://family.bananas4life.com:8443 (port 8443 - for Cloudflare)"
echo ""
echo "🔧 If you still get SSL errors, check Cloudflare settings:"
echo "   1. Go to https://dash.cloudflare.com"
echo "   2. Select bananas4life.com domain"
echo "   3. Go to SSL/TLS > Overview"
echo "   4. Set encryption mode to 'Full' or 'Full (strict)'"
echo "   5. Go to SSL/TLS > Edge Certificates"
echo "   6. Enable 'Always Use HTTPS'"
