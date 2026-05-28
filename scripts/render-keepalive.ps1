# Render 保活脚本 — 每 10 分钟 ping 一次 API，防止免费层休眠
# 可手动运行，也可通过 Windows 任务计划程序定时执行

$apiUrl = "https://sparkflow-jych.onrender.com/api/context/sync-state"
$apiKey = "sk_live_5a1c15b00c89417021f9538737e2736ce31f4fcc27732934"
$logFile = "$PSScriptRoot\.keepalive-log.txt"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Headers @{ "X-API-Key" = $apiKey } -Method GET -TimeoutSec 30
    $entryCount = if ($response.entries) { $response.entries.Count } else { 0 }
    "$timestamp  ✅ 保活成功 | 条目数: $entryCount" | Out-File -FilePath $logFile -Append
    Write-Host "保活成功 | 条目数: $entryCount" -ForegroundColor Green
} catch {
    $err = $_.Exception.Message
    "$timestamp  ❌ 保活失败 | $err" | Out-File -FilePath $logFile -Append
    Write-Host "保活失败: $err" -ForegroundColor Red
}
