@echo off
chcp 65001 >nul
title 代码工作台
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node 并加入 PATH。
  pause
  exit /b 1
)

echo 正在启动代码工作台（后端 4177 + 前端 5178）...
echo 活动数据保存在: %~dp0data\activity.db
echo 关闭本窗口将停止监听。
echo.

start "" "http://127.0.0.1:5178"
npm run dev