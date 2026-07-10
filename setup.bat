@echo off
echo ========================================
echo   TestLink Worker - Local Setup
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo [2/3] Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build project
    pause
    exit /b 1
)
echo.

echo [3/3] Setup complete!
echo.
echo ========================================
echo   Ready to start!
echo ========================================
echo.
echo To start the server, run:
echo   npm start
echo.
echo Then open your browser:
echo   http://localhost:3030/
echo.
echo Admin Panel:
echo   http://localhost:3030/admin.html
echo   Password: admin123
echo.
pause
