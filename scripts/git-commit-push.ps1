# 本地有改动则提交，再 pull --rebase 后 push（避免 remote rejected）
param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

if (-not (Test-Path ".git")) {
  Write-Error "请在 22job 仓库根目录使用"
  exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $Message) {
  $Message = "chore: 本地同步 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

$dirty = git status --porcelain
if ($dirty) {
  git add -A
  git commit -m $Message
  Write-Host "已提交: $Message"
} else {
  Write-Host "工作区干净，跳过 commit"
}

git pull --rebase origin $branch
git push -u origin $branch
Write-Host "推送完成: origin/$branch"