@echo off
setlocal enabledelayedexpansion

set REGISTRY=thesamoanthor
set VERSION=latest
set STACK_NAME=auth-system

echo [1/8] - Checking Docker and Docker Swarm...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not in PATH
    pause
    exit /b 1
)

echo [2/8] - Checking for registry images...
echo Checking if registry images are available...
docker pull %REGISTRY%/auth-backend:%VERSION% >nul 2>&1
if errorlevel 1 (
    echo WARNING: Cannot pull %REGISTRY%/auth-backend:%VERSION% from registry
    echo This is normal if:
    echo   - Repository doesn't exist yet
    echo   - You haven't pushed images yet  
    echo   - You're offline
    echo.
    echo Will use local images instead.
    set USE_REGISTRY=false
) else (
    echo SUCCESS: Registry images are available
    set USE_REGISTRY=true
)

echo [3/8] - Cleaning up previous deployment...
docker stack ls | findstr "%STACK_NAME%" >nul
if not errorlevel 1 (
    echo Removing existing %STACK_NAME% stack...
    docker stack rm %STACK_NAME%
    echo Waiting for cleanup...
    timeout /t 30 /nobreak >nul
)

echo [4/8] - Removing orphaned containers...
for /f "tokens=*" %%i in ('docker ps -aq --filter "name=%STACK_NAME%" 2^>nul') do (
    echo Removing container %%i
    docker rm -f %%i >nul 2>&1
)

echo [5/8] - Building/Pulling images...
if "!USE_REGISTRY!"=="true" (
    echo Using registry images - no local build required
    echo Images will be pulled during stack deployment
) else (
    echo Building local images...
    echo Building backend image...
    docker build -t %REGISTRY%/auth-backend:latest ./backend
    if errorlevel 1 (
        echo ERROR: Failed to build auth-backend image
        pause
        exit /b 1
    )
    
    echo Building frontend image...
    docker build -t %REGISTRY%/auth-frontend:latest ./frontend
    if errorlevel 1 (
        echo ERROR: Failed to build auth-frontend image
        pause
        exit /b 1
    )
)

echo [6/8] - Initializing Docker Swarm...
docker node ls >nul 2>&1
if errorlevel 1 (
    echo Initializing new Docker Swarm...
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
docker network create -d overlay --attachable app-network 2>nul || echo Network already exists

echo Creating volumes...
docker volume create postgres_data 2>nul || echo Volume already exists
docker volume create redis_data 2>nul || echo Volume already exists

echo [7/8] - Deploying stack...
if "!USE_REGISTRY!"=="true" (
    echo Deploying from REGISTRY: %REGISTRY%/auth-*:%VERSION%
    echo Anyone can pull these images if repositories are public!
    docker stack deploy -c docker-compose.swarm.yml %STACK_NAME%
) else (
    echo Deploying from LOCAL images
    echo Building and tagging local images for swarm...
    docker build -t %REGISTRY%/auth-backend:%VERSION% ./backend
    docker build -t %REGISTRY%/auth-frontend:%VERSION% ./frontend
    docker stack deploy -c docker-compose.swarm.yml %STACK_NAME%
)

echo.
echo ========================================
echo DEPLOYMENT COMPLETE
echo ========================================
if "!USE_REGISTRY!"=="true" (
    echo USING PUBLIC REGISTRY: %REGISTRY%
    echo IMAGE VERSION: %VERSION%
    echo.
    echo IMAGES ARE PUBLICLY ACCESSIBLE
    echo Anyone can run: docker pull %REGISTRY%/auth-backend:%VERSION%
) else (
    echo USING LOCAL IMAGES
    echo To use registry: create public repositories on Docker Hub
)
echo STACK NAME: %STACK_NAME%
echo.
echo Waiting 45 seconds for services to start...
timeout /t 45 /nobreak >nul

echo.
echo ========================================
echo SERVICE STATUS
echo ========================================
docker service ls --filter name=%STACK_NAME%_

echo.
echo ========================================
echo IMPORTANT NOTES
echo ========================================
if "!USE_REGISTRY!"=="true" (
    echo Using public Docker Hub images
    echo Others can deploy your app with:
    echo    docker pull %REGISTRY%/auth-backend:%VERSION%
    echo    docker pull %REGISTRY%/auth-frontend:%VERSION%
) else (
    echo To make images publicly available:
    echo    1. Create repositories on Docker Hub:
    echo       https://hub.docker.com/repository/create
    echo    2. Build and push images once:
    echo       docker build -t %REGISTRY%/auth-backend:latest ./backend
    echo       docker push %REGISTRY%/auth-backend:latest
    echo       docker build -t %REGISTRY%/auth-frontend:latest ./frontend  
    echo       docker push %REGISTRY%/auth-frontend:latest
    echo    3. Update docker-compose.swarm.yml to use registry images
)
echo.
echo ========================================
echo Now entering interactive mode...
echo Type 'help' for available commands
echo ========================================

:interactive
echo.
set /p "cmd=Command [%STACK_NAME%]> "
if "!cmd!"=="" goto interactive

set "cmd=!cmd: =!"
set "clean_cmd=!cmd!"
if not "!clean_cmd!"=="" (
    set "clean_cmd=!clean_cmd:~0,1!"
)

if /i "!cmd!"=="exit" goto cmd_exit
if /i "!cmd!"=="help" goto cmd_help
if /i "!cmd!"=="status" goto cmd_status
if /i "!cmd!"=="logs" goto cmd_logs
if /i "!cmd!"=="stats" goto cmd_stats
if /i "!cmd!"=="remove" goto cmd_remove
if /i "!cmd!"=="cleanup" goto cmd_cleanup
if /i "!cmd!"=="registry" goto cmd_registry

echo.
echo Unknown command: "!cmd!"
echo Type 'help' for available commands
goto interactive

:cmd_exit
echo Exiting interactive mode...
timeout /t 2 /nobreak >nul
exit /b 0

:cmd_help
echo.
echo ========================================
echo AVAILABLE COMMANDS
echo ========================================
echo.
echo BASIC COMMANDS:
echo   status    - Show service status
echo   logs      - Show service logs  
echo   stats     - Show resource usage
echo   registry  - Show registry info
echo   help      - Show this help
echo   exit      - Exit interactive mode
echo.
echo DANGER ZONE:
echo   remove    - Remove stack only
echo   cleanup   - Remove stack and leave swarm
echo.
echo ========================================
goto interactive

:cmd_status
echo.
echo === Service Status ===
docker service ls --filter "name=%STACK_NAME%_"
echo.
echo === Detailed Task Status ===
for /f "tokens=1" %%i in ('docker service ls --filter "name=%STACK_NAME%_" --format "{{.Name}}" 2^>nul') do (
    echo Service: %%i
    docker service ps %%i --format "table {{.Name}}\t{{.Node}}\t{{.DesiredState}}\t{{.CurrentState}}" 2>nul
    echo.
)
goto interactive

:cmd_logs
echo.
echo Which service logs?
echo   1 - Frontend
echo   2 - Auth Service  
echo   3 - User Service
echo   4 - Database
echo   5 - Redis
echo   6 - All Services (last 10 lines)
set /p "log_choice=Enter choice (1-6): "
if "!log_choice!"=="" goto interactive

if "!log_choice!"=="1" (
    echo === %STACK_NAME%_frontend logs ===
    docker service logs %STACK_NAME%_frontend --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!log_choice!"=="2" (
    echo === %STACK_NAME%_auth_service logs ===
    docker service logs %STACK_NAME%_auth_service --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!log_choice!"=="3" (
    echo === %STACK_NAME%_user_service logs ===
    docker service logs %STACK_NAME%_user_service --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!log_choice!"=="4" (
    echo === %STACK_NAME%_database logs ===
    docker service logs %STACK_NAME%_database --tail 15 --timestamps 2>nul || echo Service not found or no logs
) else if "!log_choice!"=="5" (
    echo === %STACK_NAME%_cache logs ===
    docker service logs %STACK_NAME%_cache --tail 15 --timestamps 2>nul || echo Service not found or no logs
) else if "!log_choice!"=="6" (
    for /f "tokens=1" %%i in ('docker service ls --filter "name=%STACK_NAME%_" --format "{{.Name}}" 2^>nul') do (
        echo === %%i logs ===
        docker service logs %%i --tail 10 --timestamps 2>nul | head -n 20
        echo.
    )
) else (
    echo Invalid choice
)
goto interactive

:cmd_stats
echo.
echo === Container Resource Usage ===
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | findstr "%STACK_NAME%" 2>nul || echo No running containers found
goto interactive

:cmd_remove
echo.
set /p "confirm=Remove stack %STACK_NAME%? (y/N): "
if /i not "!confirm!"=="y" (
    echo Removal cancelled.
    goto interactive
)

echo Removing stack...
docker stack rm %STACK_NAME%
echo.
echo Waiting for stack removal to complete...
timeout /t 15 /nobreak >nul

echo Cleaning up orphaned containers...
for /f "tokens=*" %%i in ('docker ps -aq --filter "name=%STACK_NAME%" 2^>nul') do (
    echo Removing container %%i
    docker rm -f %%i >nul 2>&1
)

echo Cleaning up networks...
for /f "tokens=*" %%i in ('docker network ls --filter "name=%STACK_NAME%" --format "{{.Name}}" 2^>nul') do (
    echo Removing network %%i
    docker network rm %%i >nul 2>&1
)

echo.
echo ========================================
echo STACK REMOVED SUCCESSFULLY!
echo ========================================
echo Stack %STACK_NAME% has been removed.
echo Docker Swarm is still active.
echo.
echo You can:
echo   - Redeploy with this script
echo   - Use 'cleanup' to leave swarm completely
echo   - Run 'exit' to close
echo.
goto interactive

:cmd_cleanup
echo.
echo DANGER ZONE - COMPLETE CLEANUP!
echo.
echo This will:
echo   1. Remove stack %STACK_NAME%
echo   2. Clean up all containers and networks
echo   3. Leave Docker Swarm mode
echo   4. Remove all swarm resources
echo.
set /p "confirm=Are you ABSOLUTELY sure? (type 'YES' to confirm): "
if /i not "!confirm!"=="YES" (
    echo Cleanup cancelled.
    goto interactive
)

echo.
echo Step 1: Removing stack...
docker stack rm %STACK_NAME% 2>nul
timeout /t 10 /nobreak >nul

echo Step 2: Cleaning up containers...
for /f "tokens=*" %%i in ('docker ps -aq --filter "name=%STACK_NAME%" 2^>nul') do (
    docker rm -f %%i >nul 2>&1
)

echo Step 3: Removing networks...
for /f "tokens=*" %%i in ('docker network ls --filter "name=%STACK_NAME%" --format "{{.Name}}" 2^>nul') do (
    docker network rm %%i >nul 2>&1
)

echo Step 4: Leaving Docker Swarm...
docker swarm leave --force

echo Step 5: Cleaning up volumes...
docker volume prune -f >nul 2>&1

echo.
echo ========================================
echo CLEANUP COMPLETE!
echo ========================================
echo All stack resources have been removed.
echo Docker Swarm has been left.
echo Volumes have been pruned.
echo.
echo You can now:
echo   - Exit this script
echo   - Restart fresh deployment
echo   - Run in regular Docker Compose mode
echo.
set /p "exitnow=Press Enter to exit..."
exit /b 0

:cmd_registry
echo.
echo === Registry Information ===
if "!USE_REGISTRY!"=="true" (
    echo Status: Using PUBLIC registry images
    echo Registry: %REGISTRY%
    echo Version: %VERSION%
    echo.
    echo These images are PUBLICLY ACCESSIBLE
    echo Others can deploy your app with:
    echo   docker pull %REGISTRY%/auth-backend:%VERSION%
    echo   docker pull %REGISTRY%/auth-frontend:%VERSION%
) else (
    echo Status: Using local images
    echo.
    echo To use public registry:
    echo 1. Create PUBLIC repositories on Docker Hub:
    echo    - %REGISTRY%/auth-backend
    echo    - %REGISTRY%/auth-frontend
    echo 2. Build and push images once:
    echo    docker build -t %REGISTRY%/auth-backend:latest ./backend
    echo    docker push %REGISTRY%/auth-backend:latest
    echo    docker build -t %REGISTRY%/auth-frontend:latest ./frontend  
    echo    docker push %REGISTRY%/auth-frontend:latest
    echo 3. Restart this script
)
goto interactive