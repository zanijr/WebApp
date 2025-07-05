# 🚨 Quick Server Fix - Handle Git Conflicts

You have local changes that are preventing the git pull. Here's how to fix it:

## Step 1: Stash Local Changes
```bash
cd /home/zbonham/WebApp
git stash
```

## Step 2: Pull Latest Changes
```bash
git pull origin main
```

## Step 3: Run the SSL Fix Script
```bash
chmod +x fix-ssl-8443.sh
./fix-ssl-8443.sh
```

## Alternative: Force Update (if stash doesn't work)
If the stash command doesn't work, you can force update:

```bash
cd /home/zbonham/WebApp
git reset --hard HEAD
git pull origin main
chmod +x fix-ssl-8443.sh
./fix-ssl-8443.sh
```

## What This Will Do:
1. ✅ Clear any local changes blocking the update
2. ✅ Pull the latest SSL configuration
3. ✅ Set up HTTPS on port 8443
4. ✅ Restart services with SSL support

## Test After Running:
```bash
# Test HTTP
curl -I http://localhost/

# Test HTTPS on 8443
curl -k -I https://localhost:8443/

# Check if containers are running
docker ps
```

Your site should then work at:
- `http://family.bananas4life.com`
- `https://family.bananas4life.com:8443`
