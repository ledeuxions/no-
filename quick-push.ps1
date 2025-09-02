<# [1] 메시지 파라미터 #>
param([string]$Msg = "chore: quick push")

<# [2] git 확인 #>
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found"
  exit 1
}

<# [3] 변경 없으면 종료 #>
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "No changes to commit."
  exit 0
}

<# [4] 커밋/푸시 #>
git add -A | Out-Null
git commit -m $Msg | Out-Null
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git push origin $branch
Write-Host "Pushed to $branch: $Msg"
