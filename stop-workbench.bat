@echo off
chcp 65001 >nul
echo 结束占用 4177 / 5178 的 node 进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4177" ^| findstr LISTENING') do taskkill /PID %%a /F 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5178" ^| findstr LISTENING') do taskkill /PID %%a /F 2>nul
echo 完成。若仍有残留，请任务管理器结束 node.exe。
pause