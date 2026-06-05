@echo off
chcp 437 >nul
cd /d "%~dp0"
echo ==========================================
echo  Fixing Electron...
echo ==========================================
echo.

echo [Step 1] Set mirror...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo [Step 2] Remove broken dist folder...
if exist "node_modules\electron\dist" (
    rmdir /s /q "node_modules\electron\dist"
    echo     Removed old dist folder.
) else (
    echo     No dist folder found, skip.
)

echo [Step 3] Run install.js...
node "node_modules\electron\install.js"

echo [Step 4] Check if electron.exe exists...
if exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo [OK] SUCCESS! electron.exe is ready.
    echo.
    pause
    exit /b 0
)

echo.
echo [WARN] Auto-download failed. Trying manual download...
echo [Step 5] Download Electron v31.0.0 via PowerShell...

set ZIP_URL=https://npmmirror.com/mirrors/electron/31.0.0/electron-v31.0.0-win32-x64.zip
set ZIP_FILE=%TEMP%\electron-v31.0.0-win32-x64.zip

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_FILE%' -TimeoutSec 300; Write-Host 'Download OK' } catch { Write-Host 'Download FAILED'; exit 1 }"

if not exist "%ZIP_FILE%" (
    echo.
    echo [FAIL] Download failed. Check your internet.
    echo     You can manually download this file and extract to node_modules\electron\dist\ :
    echo     %ZIP_URL%
    pause
    exit /b 1
)

echo     Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath 'node_modules\electron\dist' -Force"

if exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo [OK] SUCCESS! Manual download and extract done.
    del "%ZIP_FILE%"
) else (
    echo.
    echo [FAIL] Still no electron.exe after extract.
)

echo.
pause
