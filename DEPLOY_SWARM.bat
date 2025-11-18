@echo off
setlocal enabledelayedexpansion

set REGISTRY=thesamoanthor
set VERSION=latest
set STACK_NAME=auth-system

echo oh, sh..., here we go again...
echo ========================================
echo DOCKER SWARM DEPLOYMENT
echo ========================================
echo.

echo [1/7] - Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo Docker is available

echo [2/7] - Checking for registry images...
docker pull %REGISTRY%/auth-backend:%VERSION% >nul 2>&1
if errorlevel 1 (
    echo Using local images (registry images not available)
    set USE_REGISTRY=false
) else (
    echo Using registry images
    set USE_REGISTRY=true
)

echo [3/7] - Cleaning up previous deployment...
docker stack ls | findstr "%STACK_NAME%" >nul
if not errorlevel 1 (
    echo Removing existing stack '%STACK_NAME%'...
    docker stack rm %STACK_NAME%
    timeout /t 10 /nobreak >nul
    
    echo Cleaning up orphaned containers...
    for /f "tokens=*" %%i in ('docker ps -aq --filter "name=%STACK_NAME%" 2^>nul') do (
        docker rm -f %%i >nul 2>&1
    )
)

echo [4/7] - Building/Pulling images...
if "!USE_REGISTRY!"=="true" (
    echo Using registry images - no build required
) else (
    echo Building local images...
    echo Building backend image...
    docker build -t %REGISTRY%/auth-backend:%VERSION% ./backend
    if errorlevel 1 (
        echo ERROR: Failed to build backend image
        pause
        exit /b 1
    )
    
    echo Building frontend image...
    docker build -t %REGISTRY%/auth-frontend:%VERSION% ./frontend
    if errorlevel 1 (
        echo ERROR: Failed to build frontend image
        pause
        exit /b 1
    )
)

echo [5/7] - Initializing Docker Swarm...
docker node ls >nul 2>&1
if errorlevel 1 (
    echo Initializing Docker Swarm...
    docker swarm init
    if errorlevel 1 (
        echo ERROR: Failed to initialize Docker Swarm
        pause
        exit /b 1
    )
) else (
    echo Docker Swarm is already initialized
)

echo Creating overlay network...
docker network create -d overlay --attachable app-network 2>nul && echo Network created || echo Network already exists

echo Creating volumes...
docker volume create postgres_data 2>nul && echo Volume created || echo Volume already exists
docker volume create redis_data 2>nul && echo Volume created || echo Volume already exists

echo [6/7] - Deploying stack '%STACK_NAME%'...
docker stack deploy -c docker-compose.swarm.yml %STACK_NAME%
if errorlevel 1 (
    echo ERROR: Failed to deploy stack
    pause
    exit /b 1
)

echo [7/7] - Waiting for services to start...
echo This may take 30-45 seconds...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo DEPLOYMENT COMPLETE
echo ========================================
echo Stack: %STACK_NAME%
if "!USE_REGISTRY!"=="true" (
    echo Source: Registry (%REGISTRY%)
    echo Note: Images are publicly accessible
) else (
    echo Source: Local images
)
echo.

echo Service Status:
docker service ls --filter name=%STACK_NAME%_

echo.
echo Access the application at: http://localhost
echo.
echo To manage the stack, run: MANAGE_SWARM.bat
echo.

pause