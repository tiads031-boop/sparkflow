@echo off
chcp 65001 >nul
echo ========================================
echo  SparkFlow Render 保活任务配置
echo ========================================
echo.

schtasks /create /tn "SparkFlow-Render-Keepalive" /tr "powershell -ExecutionPolicy Bypass -File D:\Mindd\Work\sparkflow\scripts\render-keepalive.ps1" /sc minute /mo 10 /ru SYSTEM /f

if %errorlevel% == 0 (
    echo ✅ 定时任务创建成功
    echo    任务名: SparkFlow-Render-Keepalive
    echo    间隔: 每 10 分钟
    echo    脚本: D:\Mindd\Work\sparkflow\scripts\render-keepalive.ps1
    echo.
    echo 查看日志: scripts\.keepalive-log.txt
    pause
) else (
    echo ❌ 创建失败（可能需要以管理员身份运行此批处理）
    pause
)
