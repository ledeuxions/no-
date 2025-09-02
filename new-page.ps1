<# ===========================
 [1] 파라미터
=========================== #>
param(
  [Parameter(Mandatory=$true)][string]$Name,  # 예: faq
  [string]$Title = $null                      # 예: FAQ (미입력시 Name 사용)
)

$Title = if ($Title) { $Title } else { $Name }
$filename = "$Name.html"

<# [2] 이미 존재하면 중단 #>
if (Test-Path $filename) {
  Write-Error "$filename already exists."
  exit 1
}

<# [3] 페이지 기본 템플릿 생성 #>
$page = @"
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${Title} — NO열정페이</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="/assets/logo.svg" />
</head>
<body class="min-h-screen bg-slate-950 text-slate-100">
  <nav class="sticky top-0 z-50 bg-black/30 backdrop-blur border-b border-white/10">
    <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 font-semibold">
        <img src="/assets/logo.svg" alt="logo" class="w-6 h-6" />
        <span>NO열정페이</span>
      </a>
      <a href="/board.html" class="text-sm hover:underline">게시판</a>
    </div>
  </nav>

  <main class="max-w-3xl mx-auto px-4 mt-8 space-y-6">
    <h1 class="text-2xl md:text-3xl font-bold">${Title}</h1>
    <p class="text-slate-300">여기에 내용을 작성하세요.</p>
  </main>

  <footer class="max-w-3xl mx-auto w-full px-4 my-10 text-xs text-slate-500">
    © 2025 NO열정페이 — Beta.
  </footer>
</body>
</html>
"@

$page | Out-File -Encoding utf8 $filename
Write-Host "Created $filename"

<# [4] index.html 네비게이션에 링크 자동 삽입
     마커: "<!-- [5-1] 새 페이지를 만들면 여기 링크만 추가 -->" #>
$index = "index.html"
$marker = "<!-- [5-1] 새 페이지를 만들면 여기 링크만 추가 -->"
if (Test-Path $index) {
  $content = Get-Content $index -Raw -Encoding UTF8
  if ($content.Contains($marker)) {
    $linkLine = "        <a href=""/$filename"" class=""hover:underline"">$Title</a>`r`n        $marker"
    $content = $content.Replace($marker, $linkLine)
    Set-Content -Path $index -Value $content -Encoding UTF8
    Write-Host "Updated index.html nav with link for $filename"
  } else {
    Write-Warning "Marker not found in index.html. 링크는 수동으로 추가해 주세요."
  }
} else {
  Write-Warning "index.html not found; skipped nav update."
}

<# [5] git 커밋/푸시 (repo일 때만) #>
if (Get-Command git -ErrorAction SilentlyContinue) {
  $inside = (git rev-parse --is-inside-work-tree) 2>$null
  if ($inside -eq "true") {
    git add $filename index.html | Out-Null
    git commit -m "feat: add $filename" | Out-Null
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    git push origin $branch
    Write-Host "Pushed new page on branch $branch"
  }
}
