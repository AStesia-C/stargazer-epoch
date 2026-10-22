@echo off
setlocal
cd /d "%~dp0"
set PORT=8123
set PY=

where py >nul 2>nul
if %errorlevel%==0 set PY=py
if not "%PY%"=="" goto serve

where python >nul 2>nul
if %errorlevel%==0 set PY=python
if not "%PY%"=="" goto serve
goto nopython

:serve
echo Starting Stargazer Epoch on http://localhost:%PORT%/index.html
start "Stargazer Server" /min cmd /c "%PY% -m http.server %PORT%"
ping 127.0.0.1 -n 3 >nul
start "" "http://localhost:%PORT%/index.html"
echo.
echo The game should now be open in your browser.
echo Close the "Stargazer Server" window to stop the server.
ping 127.0.0.1 -n 7 >nul
exit /b

:nopython
echo Python was not found on this PC.
echo Opening the game directly from the file system instead.
echo Saves still work, but a local server is recommended.
start "" "%~dp0index.html"
ping 127.0.0.1 -n 6 >nul
exit /b
