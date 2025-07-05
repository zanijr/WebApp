@echo off
echo Starting Family Chores App...
echo.

echo Checking Docker Desktop...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker Desktop is not running. Please start Docker Desktop first.
    echo.
    echo Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker Desktop to start...
    timeout /t 30 /nobreak >nul
    
    :wait_for_docker
    docker ps >nul 2>&1
    if %errorlevel% neq 0 (
        echo Still waiting for Docker Desktop...
        timeout /t 5 /nobreak >nul
        goto wait_for_docker
    )
)

echo Docker Desktop is running!
echo.

echo Building and starting the application...
docker-compose up --build

echo.
echo Application should be available at:
echo - http://localhost
echo - http://192.168.12.220
echo.
pause
