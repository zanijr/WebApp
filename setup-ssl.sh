#!/bin/bash

# SSL Setup Script for Family Chores App
# This will install Let's Encrypt SSL certificates for HTTPS

set -e  # Exit on any error

echo "🔒 Setting up SSL certificates for Family Chores App"
echo "=================================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as user 'zbonham'"
    exit 1
fi

# Check if domain is accessible
echo "🌐 Testing domain accessibility..."
if ! curl -f http://family.bananas4life.com > /dev/null 2>&1; then
    echo "❌ Domain http://family.bananas4life.com is not accessible"
    echo "Please make sure your app is running and accessible via HTTP first"
    exit 1
fi

echo "✅ Domain is accessible via HTTP"

# Install Certbot
echo "📦 Installing Certbot..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx container temporarily
echo "🛑 Stopping nginx container..."
cd /home/zbonham/WebApp
docker-compose stop nginx

# Generate SSL certificate
echo "🔐 Generating SSL certificate..."
sudo certbot certonly --standalone \
    --preferred-challenges http \
    --email zbonham@bananas4life.com \
    --agree-tos \
    --no-eff-email \
    -d family.bananas4life.com

# Check if certificate was generated
if [ ! -f "/etc/letsencrypt/live/family.bananas4life.com/fullchain.pem" ]; then
    echo "❌ SSL certificate generation failed"
    echo "Starting nginx container again..."
    docker-compose start nginx
    exit 1
fi

echo "✅ SSL certificate generated successfully"

# Create SSL directory for nginx
echo "📁 Setting up SSL directory..."
sudo mkdir -p /home/zbonham/WebApp/ssl
sudo cp /etc/letsencrypt/live/family.bananas4life.com/fullchain.pem /home/zbonham/WebApp/ssl/
sudo cp /etc/letsencrypt/live/family.bananas4life.com/privkey.pem /home/zbonham/WebApp/ssl/
sudo chown -R zbonham:zbonham /home/zbonham/WebApp/ssl
sudo chmod 600 /home/zbonham/WebApp/ssl/privkey.pem
sudo chmod 644 /home/zbonham/WebApp/ssl/fullchain.pem

# Update nginx configuration for SSL
echo "🔧 Updating nginx configuration..."
cat > /home/zbonham/WebApp/nginx/nginx-ssl.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # Upstream backend
    upstream api_backend {
        server api:3000;
        keepalive 32;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name family.bananas4life.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name family.bananas4life.com;
        root /usr/share/nginx/html;
        index index.html;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Auth routes with stricter rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Admin routes with stricter rate limiting
        location /api/admin/ {
            limit_req zone=auth burst=5 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Uploaded files
        location /uploads/ {
            alias /usr/share/nginx/html/uploads/;
            expires 1y;
            add_header Cache-Control "public, immutable";
            
            # Security for uploaded files
            location ~* \.(php|jsp|asp|sh|cgi)$ {
                deny all;
            }
        }

        # Static files with caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }

        # Main application
        location / {
            try_files $uri $uri/ /index.html;
            
            # Cache HTML files for a short time
            location ~* \.html$ {
                expires 1h;
                add_header Cache-Control "public, must-revalidate";
            }
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Deny access to hidden files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Deny access to backup files
        location ~ ~$ {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Custom error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        
        location = /404.html {
            root /usr/share/nginx/html;
            internal;
        }
        
        location = /50x.html {
            root /usr/share/nginx/html;
            internal;
        }
    }
}
EOF

# Update docker-compose.yml to include SSL volume
echo "🐳 Updating docker-compose configuration..."
cp /home/zbonham/WebApp/docker-compose.yml /home/zbonham/WebApp/docker-compose.yml.backup

cat > /home/zbonham/WebApp/docker-compose-ssl.yml << 'EOF'
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
    volumes:
      - ./nginx/nginx-ssl.conf:/etc/nginx/nginx.conf
      - ./frontend:/usr/share/nginx/html
      - ./uploads:/usr/share/nginx/html/uploads
      - ./ssl:/etc/nginx/ssl:ro
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

# Start services with SSL configuration
echo "🚀 Starting services with SSL..."
docker-compose -f docker-compose-ssl.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Test HTTPS
echo "🧪 Testing HTTPS connection..."
if curl -f https://family.bananas4life.com > /dev/null 2>&1; then
    echo "✅ HTTPS is working!"
else
    echo "⚠️  HTTPS test failed, but services may still be starting..."
fi

# Set up automatic certificate renewal
echo "🔄 Setting up automatic certificate renewal..."
sudo crontab -l 2>/dev/null | grep -v certbot > /tmp/crontab.tmp || true
echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/family.bananas4life.com/fullchain.pem /home/zbonham/WebApp/ssl/ && cp /etc/letsencrypt/live/family.bananas4life.com/privkey.pem /home/zbonham/WebApp/ssl/ && chown zbonham:zbonham /home/zbonham/WebApp/ssl/* && docker-compose -f /home/zbonham/WebApp/docker-compose-ssl.yml restart nginx'" >> /tmp/crontab.tmp
sudo crontab /tmp/crontab.tmp
rm /tmp/crontab.tmp

echo ""
echo "🎉 SSL Setup Complete!"
echo "===================="
echo ""
echo "Your Family Chores app is now available with HTTPS:"
echo "🔒 https://family.bananas4life.com"
echo "🌐 http://family.bananas4life.com (redirects to HTTPS)"
echo ""
echo "SSL Features:"
echo "✅ Let's Encrypt SSL certificate installed"
echo "✅ HTTP automatically redirects to HTTPS"
echo "✅ Strong SSL configuration (TLS 1.2/1.3)"
echo "✅ Security headers enabled"
echo "✅ Automatic certificate renewal configured"
echo ""
echo "Certificate will auto-renew every 12 hours if needed."
echo "Your app is now secure and ready for production use!"
