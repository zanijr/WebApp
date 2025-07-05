# Fix DNS Configuration in Cloudflare

## 🚨 Problem Identified
The subdomain `family.bananas4life.com` is currently pointing to your main website instead of your Family Chores app server at `192.168.12.220`.

## 🔧 Solution: Update DNS Record in Cloudflare

### Step 1: Access Cloudflare DNS Settings
1. Go to https://dash.cloudflare.com
2. Select your `bananas4life.com` domain
3. Click on **DNS** in the left sidebar

### Step 2: Find the 'family' DNS Record
Look for a DNS record with:
- **Name:** `family`
- **Type:** `A` or `CNAME`

### Step 3: Update the DNS Record
**If it's an A record:**
- **Type:** A
- **Name:** family
- **IPv4 address:** `192.168.12.220`
- **Proxy status:** 🟠 Proxied (orange cloud)
- **TTL:** Auto

**If it's a CNAME record:**
- Delete the CNAME record
- Create a new A record with the settings above

### Step 4: Save Changes
Click **Save** to apply the changes.

## ⏱️ DNS Propagation
- Changes may take 1-5 minutes to take effect
- Cloudflare's proxy will cache the old record briefly

## 🧪 Test the Fix
After making the DNS change, test:
1. `http://family.bananas4life.com` - should show your Family Chores app
2. `https://family.bananas4life.com` - should show your Family Chores app with SSL

## 🎯 Expected Result
- ✅ `family.bananas4life.com` → Your Family Chores App (192.168.12.220)
- ✅ `bananas4life.com` → Your main website (unchanged)
- ✅ HTTPS will work automatically via Cloudflare SSL

## 🔍 Current DNS Status Check
You can verify the current DNS record points to the correct IP:
```bash
nslookup family.bananas4life.com
```

Should return: `192.168.12.220`

## 📝 Summary
The Family Chores app is working perfectly on your server. The only issue is that the DNS record for `family.bananas4life.com` needs to point to `192.168.12.220` instead of your main website.

Once this DNS change is made, both HTTP and HTTPS will work immediately thanks to Cloudflare's SSL!
