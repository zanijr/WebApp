#!/bin/bash

# SSL Setup Script for Family Chores App (Cloudflare Compatible)
# This will install Let's Encrypt SSL certificates for HTTPS using DNS challenge

set -e  # Exit on any error

echo "🔒 Setting up SSL certificates for Family Chores App (Cloudflare)"
echo "=============================================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as user 'zbonham'"
    exit 1
fi

echo "🌐 Cloudflare SSL Setup Instructions"
echo "===================================="
echo ""
echo "Since you're using Cloudflare, we have two options:"
echo ""
echo "Option 1: Use Cloudflare's SSL (Recommended - Easier)"
echo "Option 2: Use Let's Encrypt with DNS challenge (Advanced)"
echo ""
echo "Which option would you like?"
echo "1) Cloudflare SSL (Easy setup)"
echo "2) Let's Encrypt DNS challenge (Advanced)"
echo "3) Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔧 Setting up Cloudflare SSL..."
        echo "==============================="
        echo ""
        echo "Steps to enable Cloudflare SSL:"
        echo ""
        echo "1. Go to your Cloudflare dashboard"
        echo "2. Select bananas4life.com domain"
        echo "3. Go to SSL/TLS tab"
        echo "4. Set SSL/TLS encryption mode to 'Full (strict)'"
        echo "5. Go to SSL/TLS > Edge Certificates"
        echo "6. Enable 'Always Use HTTPS'"
        echo ""
        echo "This will automatically provide SSL for your domain!"
        echo ""
        echo "After enabling in Cloudflare:"
        echo "- https://family.bananas4life.com will work automatically"
        echo "- HTTP will redirect to HTTPS"
        echo "- No server-side SSL setup needed"
        echo ""
        echo "✅ Cloudflare SSL is the easiest option for your setup!"
        ;;
    2)
        echo ""
        echo "🔧 Setting up Let's Encrypt with DNS challenge..."
        echo "================================================"
        echo ""
        echo "This requires Cloudflare API credentials."
        echo ""
        read -p "Do you have your Cloudflare API token? (y/n): " has_token
        
        if [ "$has_token" != "y" ]; then
            echo ""
            echo "To get your Cloudflare API token:"
            echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
            echo "2. Click 'Create Token'"
            echo "3. Use 'Edit zone DNS' template"
            echo "4. Select your bananas4life.com zone"
            echo "5. Copy the token"
            echo ""
            echo "Run this script again when you have the token."
            exit 0
        fi
        
        echo ""
        read -p "Enter your Cloudflare API token: " cf_token
        read -p "Enter your Cloudflare email: " cf_email
        
        # Install certbot with Cloudflare plugin
        echo "📦 Installing Certbot with Cloudflare plugin..."
        sudo apt update
        sudo apt install -y certbot python3-certbot-dns-cloudflare
        
        # Create Cloudflare credentials file
        echo "🔑 Setting up Cloudflare credentials..."
        mkdir -p ~/.secrets
        cat > ~/.secrets/cloudflare.ini << EOF
dns_cloudflare_email = $cf_email
dns_cloudflare_api_key = $cf_token
EOF
        chmod 600 ~/.secrets/cloudflare.ini
        
        # Generate SSL certificate using DNS challenge
        echo "🔐 Generating SSL certificate..."
        sudo certbot certonly \
            --dns-cloudflare \
            --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
            --email $cf_email \
            --agree-tos \
            --no-eff-email \
            -d family.bananas4life.com
        
        # Check if certificate was generated
        if [ ! -f "/etc/letsencrypt/live/family.bananas4life.com/fullchain.pem" ]; then
            echo "❌ SSL certificate generation failed"
            exit 1
        fi
        
        echo "✅ SSL certificate generated successfully"
        
        # Set up SSL configuration (same as before)
        echo "📁 Setting up SSL directory..."
        sudo mkdir -p /home/zbonham/WebApp/ssl
        sudo cp /etc/letsencrypt/live/family.bananas4life.com/fullchain.pem /home/zbonham/WebApp/ssl/
        sudo cp /etc/letsencrypt/live/family.bananas4life.com/privkey.pem /home/zbonham/WebApp/ssl/
        sudo chown -R zbonham:zbonham /home/zbonham/WebApp/ssl
        sudo chmod 600 /home/zbonham/WebApp/ssl/privkey.pem
        sudo chmod 644 /home/zbonham/WebApp/ssl/fullchain.pem
        
        # Create SSL nginx config
        echo "🔧 Creating SSL nginx configuration..."
        cd /home/zbonham/WebApp
        
        # Create SSL-enabled nginx config
        cat > nginx/nginx-ssl.conf << 'EOF'
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

        # Create SSL docker-compose
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

        # Start services with SSL
        echo "🚀 Starting services with SSL..."
        docker-compose -f docker-compose-ssl.yml up -d
        
        # Set up auto-renewal
        echo "🔄 Setting up automatic certificate renewal..."
        sudo crontab -l 2>/dev/null | grep -v certbot > /tmp/crontab.tmp || true
        echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/family.bananas4life.com/fullchain.pem /home/zbonham/WebApp/ssl/ && cp /etc/letsencrypt/live/family.bananas4life.com/privkey.pem /home/zbonham/WebApp/ssl/ && chown zbonham:zbonham /home/zbonham/WebApp/ssl/* && docker-compose -f /home/zbonham/WebApp/docker-compose-ssl.yml restart nginx'" >> /tmp/crontab.tmp
        sudo crontab /tmp/crontab.tmp
        rm /tmp/crontab.tmp
        
        echo ""
        echo "🎉 Let's Encrypt SSL Setup Complete!"
        echo "===================================="
        echo ""
        echo "✅ SSL certificate installed"
        echo "✅ HTTPS enabled"
        echo "✅ Auto-renewal configured"
        echo ""
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac

echo ""
echo "🔒 SSL Setup Instructions Complete!"
echo "==================================="
echo ""
echo "Your Family Chores app will be available at:"
echo "🔒 https://family.bananas4life.com"
echo ""
echo "Choose the option that works best for your setup!"
