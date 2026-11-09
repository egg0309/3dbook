@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist logs mkdir logs
start "" /min "C:\Users\32800\miniconda3\pythonw.exe" -m app.keepalive
echo 守护进程已在后台启动。
echo 日志：%~dp0logs\keepalive.log
timeout /t 2 >nul
