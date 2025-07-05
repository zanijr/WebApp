# PowerShell script to deploy SSL fix to server

Write-Host "🚀 Deploying SSL fix to server..." -ForegroundColor Green

$SERVER_IP = "192.168.12.220"
$SERVER_USER = "zbonham"
$SERVER_PATH = "/home/zbonham/WebApp"

Write-Host "📁 Copying updated files to server..." -ForegroundColor Yellow

# Copy updated docker-compose.yml
Write-Host "Copying docker-compose.yml..."
scp docker-compose.yml "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"

# Copy updated nginx configuration
Write-Host "Copying nginx configuration..."
scp nginx/nginx.conf "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/nginx/"

# Copy SSL fix script
Write-Host "Copying SSL fix script..."
scp fix-ssl-8443.sh "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"

Write-Host ""
Write-Host "🔧 Running SSL fix on server..." -ForegroundColor Yellow
ssh "${SERVER_USER}@${SERVER_IP}" "cd ${SERVER_PATH} && chmod +x fix-ssl-8443.sh && ./fix-ssl-8443.sh"

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Test your application:" -ForegroundColor Cyan
Write-Host "   • http://family.bananas4life.com" -ForegroundColor White
Write-Host "   • https://family.bananas4life.com:8443" -ForegroundColor White
