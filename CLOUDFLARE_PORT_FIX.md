# Fix Cloudflare Port Issue

## 🚨 Problem Identified
You tried `https://family.bananas4life.com:8443` and got "SSL handshake failed" because Cloudflare doesn't support port 8443 when the proxy is enabled.

## 🔧 Solution Options

### Option 1: Use Standard Ports (Recommended)
**Update your DNS record to use standard ports:**

1. Go to https://dash.cloudflare.com
2. Select `bananas4life.com` domain
3. Click **DNS**
4. Find the `family` record
5. Update it to:
   - **Type:** A
   - **Name:** family
   - **IPv4 address:** `192.168.12.220`
   - **Proxy status:** 🟠 Proxied (orange cloud)
   - **TTL:** Auto

**Result:** Your app will be available at:
- `https://family.bananas4life.com` (port 443 - standard HTTPS)
- `http://family.bananas4life.com` (port 80 - standard HTTP)

### Option 2: Disable Cloudflare Proxy for Custom Port
**If you must use port 8443:**

1. Go to Cloudflare DNS settings
2. Find the `family` record
3. Click the orange cloud to make it gray (DNS only)
4. Update the record to:
   - **Type:** A
   - **Name:** family
   - **IPv4 address:** `192.168.12.220`
   - **Proxy status:** ⚫ DNS only (gray cloud)

**Result:** You can access `https://family.bananas4life.com:8443`
**Downside:** No Cloudflare SSL, CDN, or protection

## 🎯 Cloudflare Supported Ports (Proxied)

**HTTP:** 80, 8080, 8880, 2052, 2082, 2086, 2095
**HTTPS:** 443, 2053, 2083, 2087, 2096, 8443

Wait - 8443 IS supported! Let me check your server configuration...

## 🔍 Server Configuration Check

The issue might be that your server isn't configured to handle HTTPS on port 8443. Your Family Chores app is running on port 80 (HTTP only).

### Quick Fix: Configure Your Server for HTTPS on 8443

**On your server (192.168.12.220), run:**

```bash
# Update docker-compose to expose port 8443 with SSL
cd /home/zbonham/WebApp

# Create SSL-enabled configuration
cat > docker-compose-ssl-8443.yml << 'EOF'
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
      - "8443:8443"
    volumes:
      - ./nginx/nginx-8443.conf:/etc/nginx/nginx.conf
      - ./frontend:/usr/share/nginx/html
      - ./uploads:/usr/share/nginx/html/uploads
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

# Create nginx config for port 8443
cat > nginx/nginx-8443.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Upstream backend
    upstream api_backend {
        server api:3000;
        keepalive 32;
    }

    # HTTP server on port 80
    server {
        listen 80;
        server_name family.bananas4life.com;
        root /usr/share/nginx/html;
        index index.html;

        location /api/ {
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }

    # HTTPS server on port 8443 (for Cloudflare)
    server {
        listen 8443 ssl http2;
        server_name family.bananas4life.com;
        root /usr/share/nginx/html;
        index index.html;

        # Self-signed SSL for Cloudflare origin
        ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
        ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

        location /api/ {
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
EOF

# Restart with new configuration
docker-compose down
docker-compose -f docker-compose-ssl-8443.yml up -d
```

## 🎯 Recommendation

**Use Option 1 (Standard Ports)** - it's simpler and more reliable. Just update the DNS record to point to your server without specifying a port, and access your app at `https://family.bananas4life.com`.
