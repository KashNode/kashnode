@echo off
setlocal
set "APP_DIR=D:\KashNode"
if not exist "%APP_DIR%\package.json" (
  echo KashNode project not found at %APP_DIR%
  exit /b 1
)
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $api=Get-NetTCPConnection -State Listen -LocalPort 4892 -ErrorAction SilentlyContinue; if(-not $api){ Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c npm start' -WorkingDirectory 'D:\KashNode' -WindowStyle Minimized -RedirectStandardOutput 'D:\KashNode\logs\api.log' -RedirectStandardError 'D:\KashNode\logs\api-error.log'; Write-Output 'KashNode API starting on 127.0.0.1:4892' } else { Write-Output 'KashNode API already running on port 4892' }; $web=Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue; if(-not $web){ Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c npm run dev -- --host 127.0.0.1 --strictPort' -WorkingDirectory 'D:\KashNode' -WindowStyle Minimized -RedirectStandardOutput 'D:\KashNode\logs\web.log' -RedirectStandardError 'D:\KashNode\logs\web-error.log'; Write-Output 'KashNode web app starting on http://127.0.0.1:5173' } else { Write-Output 'KashNode web app already running on port 5173' }"
if errorlevel 1 (
  echo KashNode launch failed. Check D:\KashNode\logs\ for details.
  exit /b 1
)
echo KashNode startup request completed. See D:\KashNode\logs\ for server output.
endlocal
