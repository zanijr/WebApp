#!/bin/bash

# DNS Fix Script for Ubuntu Server
# This will configure your server to use Google DNS (8.8.8.8)

echo "🔧 Fixing DNS Configuration"
echo "=========================="

# Backup current configuration
sudo cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.backup
sudo cp /etc/resolv.conf /etc/resolv.conf.backup

# Configure systemd-resolved to use Google DNS
echo "📝 Configuring systemd-resolved..."
sudo tee /etc/systemd/resolved.conf > /dev/null <<EOF
[Resolve]
DNS=8.8.8.8 8.8.4.4
FallbackDNS=1.1.1.1 1.0.0.1
Domains=~.
DNSSEC=no
DNSOverTLS=no
Cache=yes
DNSStubListener=yes
EOF

# Restart systemd-resolved
echo "🔄 Restarting DNS service..."
sudo systemctl restart systemd-resolved

# Wait a moment
sleep 2

# Test DNS resolution
echo "🧪 Testing DNS resolution..."
if nslookup google.com > /dev/null 2>&1; then
    echo "✅ DNS resolution working!"
else
    echo "❌ DNS still not working, trying alternative method..."
    
    # Alternative: Disable systemd-resolved and use traditional resolv.conf
    sudo systemctl disable systemd-resolved
    sudo systemctl stop systemd-resolved
    
    # Remove the symlink and create a real resolv.conf
    sudo rm -f /etc/resolv.conf
    sudo tee /etc/resolv.conf > /dev/null <<EOF
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1
EOF
    
    # Make it immutable to prevent changes
    sudo chattr +i /etc/resolv.conf
    
    echo "✅ DNS configured with traditional method"
fi

# Test Docker registry access
echo "🐳 Testing Docker registry access..."
if nslookup registry-1.docker.io > /dev/null 2>&1; then
    echo "✅ Docker registry DNS resolution working!"
else
    echo "❌ Docker registry still not accessible"
fi

# Show current DNS configuration
echo ""
echo "📋 Current DNS Configuration:"
echo "resolv.conf:"
cat /etc/resolv.conf
echo ""
echo "systemd-resolved status:"
systemctl status systemd-resolved --no-pager -l

echo ""
echo "🎉 DNS fix complete!"
echo "You can now try running the deployment again."
