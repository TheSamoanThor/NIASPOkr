@echo off
setlocal enabledelayedexpansion

set STACK_NAME=auth-system
set REGISTRY=thesamoanthor
set VERSION=latest

echo ========================================
echo DOCKER SWARM MANAGEMENT
echo ========================================
echo Stack: %STACK_NAME%
echo.

echo Checking stack status...
docker stack ls | findstr "%STACK_NAME%" >nul
if errorlevel 1 (
    echo ERROR: Stack '%STACK_NAME%' is not deployed
    echo Please run DEPLOY_SWARM.bat first
    pause
    exit /b 1
)

:interactive
echo.
echo Available commands:
echo   status    - Show service status
echo   logs      - Show service logs
echo   stats     - Show resource usage
echo   remove    - Remove stack
echo   cleanup   - Complete cleanup (remove stack and leave swarm)
echo   exit      - Exit management
echo.

set /p "cmd=Command [%STACK_NAME%]> "
if "!cmd!"=="" goto interactive

if /i "!cmd!"=="exit" goto cmd_exit
if /i "!cmd!"=="status" goto cmd_status
if /i "!cmd!"=="logs" goto cmd_logs
if /i "!cmd!"=="stats" goto cmd_stats
if /i "!cmd!"=="remove" goto cmd_remove
if /i "!cmd!"=="cleanup" goto cmd_cleanup

echo Unknown command: "!cmd!"
echo Type one of the commands from the list above
goto interactive

:cmd_exit
echo Exiting management...
timeout /t 1 /nobreak >nul
exit /b 0

:cmd_status
echo.
echo === Service Status ===
docker service ls --filter "name=%STACK_NAME%_"
echo.
echo === Detailed Task Status ===
for /f "tokens=1" %%i in ('docker service ls --filter "name=%STACK_NAME%_" --format "{{.Name}}" 2^>nul') do (
    echo Service: %%i
    docker service ps %%i --format "table {{.Name}}\t{{.Node}}\t{{.DesiredState}}\t{{.CurrentState}}\t{{.Error}}" 2>nul
    echo.
)
goto interactive

:cmd_logs
echo.
echo Select service to view logs:
echo   1 - Frontend (nginx)
echo   2 - Auth Service
echo   3 - User Service  
echo   4 - Database (PostgreSQL)
echo   5 - Cache (Redis)
echo   6 - All services (last 10 lines)
set /p "choice=Enter choice [1-6]: "

if "!choice!"=="1" (
    echo === %STACK_NAME%_frontend logs ===
    docker service logs %STACK_NAME%_frontend --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!choice!"=="2" (
    echo === %STACK_NAME%_auth_service logs ===
    docker service logs %STACK_NAME%_auth_service --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!choice!"=="3" (
    echo === %STACK_NAME%_user_service logs ===
    docker service logs %STACK_NAME%_user_service --tail 20 --timestamps 2>nul || echo Service not found or no logs
) else if "!choice!"=="4" (
    echo === %STACK_NAME%_database logs ===
    docker service logs %STACK_NAME%_database --tail 15 --timestamps 2>nul || echo Service not found or no logs
) else if "!choice!"=="5" (
    echo === %STACK_NAME%_cache logs ===
    docker service logs %STACK_NAME%_cache --tail 15 --timestamps 2>nul || echo Service not found or no logs
) else if "!choice!"=="6" (
    for /f "tokens=1" %%i in ('docker service ls --filter "name=%STACK_NAME%_" --format "{{.Name}}" 2^>nul') do (
        echo === %%i logs (last 10 lines) ===
        docker service logs %%i --tail 10 --timestamps 2>nul
        echo.
    )
) else (
    echo Invalid choice
)
goto interactive

:cmd_stats
echo.
echo === Container Resource Usage ===
echo Press Ctrl+C to return to menu
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}" | findstr "%STACK_NAME%"
goto interactive

:cmd_remove
echo.
set /p "confirm=Remove stack '%STACK_NAME%'? All services will be stopped. [y/N]: "
if /i not "!confirm!"=="y" (
    echo Removal cancelled.
    goto interactive
)

echo Removing stack...
docker stack rm %STACK_NAME%
echo.
echo Waiting for removal to complete...
timeout /t 15 /nobreak >nul

echo Cleaning up orphaned resources...
for /f "tokens=*" %%i in ('docker ps -aq --filter "name=%STACK_NAME%" 2^>nul') do (
    echo Removing container %%i
    docker rm -f %%i >nul 2>&1
)

echo.
echo ========================================
echo STACK REMOVED SUCCESSFULLY
echo ========================================
echo Stack '%STACK_NAME%' has been removed.
echo Docker Swarm is still active.
echo.
echo You can:
echo   - Redeploy with DEPLOY_SWARM.bat
echo   - Run 'cleanup' to leave swarm completely
echo   - Run 'exit' to close
echo.
goto interactive

:cmd_cleanup
echo.
echo DANGER ZONE - COMPLETE CLEANUP!
echo.
echo This will:
echo   Remove stack '%STACK_NAME%'
echo   Clean up all containers and networks
echo   Leave Docker Swarm mode
echo   Remove all swarm resources
echo   Prune all unused volumes
echo.
set /p "confirm=Are you ABSOLUTELY sure? This cannot be undone! [type 'YES' to confirm]: "
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
echo CLEANUP COMPLETE
echo ========================================
echo All stack resources have been removed.
echo Docker Swarm has been left.
echo Volumes have been pruned.
echo.
echo You can now:
echo   - Exit this script
echo   - Restart fresh deployment with DEPLOY_SWARM.bat
echo   - Run in regular Docker Compose mode
echo.
set /p "exitnow=Press Enter to exit..."
exit /b 0