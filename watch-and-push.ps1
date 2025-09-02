<# ===========================
 [1] 파라미터: 경로/브랜치/딜레이
=========================== #>
param(
  [string]$Path = ".",
  # "auto" 이면 현재 체크아웃된 브랜치로 자동 설정
  [string]$Branch = "auto",
  [int]$DelayMs = 1500
)

<# [2] git 준비 확인 #>
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found. Git을 설치하고 PATH에 추가해 주세요."
  exit 1
}

<# [3] repo 확인 및 이동 #>
Set-Location $Path
$inside = (git rev-parse --is-inside-work-tree) 2>$null
if ($inside -ne "true") {
  Write-Error "현재 폴더는 git 저장소가 아닙니다."
  exit 1
}

if ($Branch -eq "auto" -or [string]::IsNullOrWhiteSpace($Branch)) {
  $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
}

Write-Host "Watching repo: $(git rev-parse --show-toplevel)"
Write-Host "Target branch: $Branch"
Write-Host "Ctrl + C 로 종료"

<# [4] 파일 변경 감시기 설치 #>
$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path = (git rev-parse --show-toplevel)
$fsw.IncludeSubdirectories = $true
$fsw.EnableRaisingEvents = $true
$fsw.Filter = "*.*"

$script:pending = $false
$handler = {
  param($s,$e)
  if ($e.FullPath -like "*\.git\*") { return } # .git 내부는 무시
  $script:pending = $true
}
Register-ObjectEvent $fsw Changed -Action $handler | Out-Null
Register-ObjectEvent $fsw Created -Action $handler | Out-Null
Register-ObjectEvent $fsw Deleted -Action $handler | Out-Null
Register-ObjectEvent $fsw Renamed -Action $handler | Out-Null

<# [5] 변경이 모이면 커밋/푸시 #>
while ($true) {
  Start-Sleep -Milliseconds $DelayMs
  if (-not $script:pending) { continue }
  $script:pending = $false

  $status = git status --porcelain
  if ([string]::IsNullOrWhiteSpace($status)) { continue }

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  git add -A | Out-Null
  git commit -m "chore(auto): save @ $stamp" | Out-Null
  git push origin $Branch
  Write-Host "Pushed at $stamp"
}
