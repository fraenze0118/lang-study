$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
$resDir = Join-Path $root 'android\app\src\main\res'
if (-not (Test-Path $apk)) { throw "APK not found: $apk" }

$aapt2 = Get-ChildItem -Path "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Recurse -Filter 'aapt2.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $aapt2) { throw 'aapt2.exe not found' }

Write-Host ("APK   : {0}  ({1})" -f (Get-Item $apk).LastWriteTime, (Get-Item $apk).Length)
Write-Host ''

# Extract the whole APK to disk and read entries from FILES, not zip streams.
# WHY: ZIP entry lookup is case-insensitive on Windows, and obfuscated resource
# names collide that way -- e.g. res/zr.png and res/zR.png are different entries
# that differ only in case. Asking the zip for "res/zr.png" can hand back
# "res/zR.png" (a 48x48 unrelated bitmap), which made an earlier version of this
# script report a FALSE mismatch.
$out = Join-Path $env:TEMP 'apk-verify-disk'
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item $apk (Join-Path $out 'a.zip')
Expand-Archive -Path (Join-Path $out 'a.zip') -DestinationPath (Join-Path $out 'x') -Force
$xres = Join-Path $out 'x\res'

function Get-Entries([string]$resourceName) {
  $dump = & $aapt2.FullName dump resources $apk 2>$null
  $line = $dump | Where-Object { $_ -match [regex]::Escape($resourceName) } | Select-Object -First 1
  if (-not $line) { return @() }
  $n = [array]::IndexOf($dump, $line)
  $acc = @()
  for ($i = $n + 1; $i -lt [Math]::Min($n + 12, $dump.Count); $i++) {
    $l = $dump[$i].Trim()
    if ($l -match '^resource ') { break }
    if ($l -match '^\((\S+)\)\s+\(file\)\s+(\S+)') { $acc += [pscustomobject]@{ Density = $Matches[1]; Entry = $Matches[2] } }
  }
  return $acc
}

$fail = 0
function Compare-Entry([string]$entry, [string]$srcPath, [string]$label) {
  # resolve case-sensitively against the real directory listing
  $leaf = Split-Path $entry -Leaf
  $hit = Get-ChildItem -Path $xres -File | Where-Object { $_.Name -ceq $leaf } | Select-Object -First 1
  if (-not $hit) { "  {0,-34} entry not found on disk" -f $label; $script:fail++; return }
  if (-not (Test-Path $srcPath)) { "  {0,-34} source missing" -f $label; $script:fail++; return }
  $a = New-Object System.Drawing.Bitmap($hit.FullName)
  $s = New-Object System.Drawing.Bitmap($srcPath)
  $sx = $a.Width / [double]$s.Width; $sy = $a.Height / [double]$s.Height
  $step = [Math]::Max(1, [int]($s.Width / 32))
  $diff = 0; $n = 0
  for ($y = 0; $y -lt $s.Height; $y += $step) {
    for ($x = 0; $x -lt $s.Width; $x += $step) {
      $ax = [Math]::Min($a.Width - 1, [int]($x * $sx)); $ay = [Math]::Min($a.Height - 1, [int]($y * $sy))
      $n++
      if ($a.GetPixel($ax, $ay).ToArgb() -ne $s.GetPixel($x, $y).ToArgb()) { $diff++ }
    }
  }
  $pct = $diff / [double]$n
  if ($pct -ge 0.02) { $script:fail++ }
  "  {0,-34} apk {1,4}x{2,-4} src {3,4}x{4,-4}  diff {5,6:P2}  -> {6}" -f `
    $label, $a.Width, $a.Height, $s.Width, $s.Height, $pct, $(if ($pct -lt 0.02) { 'MATCHES' } else { 'DIFFERENT' })
  $a.Dispose(); $s.Dispose()
}

foreach ($res in @('mipmap/ic_launcher_foreground', 'mipmap/ic_launcher')) {
  $isFg = $res -like '*foreground*'
  Write-Host ("=== {0} ===" -f $res)
  foreach ($e in (Get-Entries $res)) {
    if ($e.Density -like 'anydpi*') { continue }
    $name = if ($isFg) { 'ic_launcher_foreground.png' } else { 'ic_launcher.png' }
    Compare-Entry $e.Entry (Join-Path $resDir ("mipmap-{0}\{1}" -f $e.Density, $name)) ("{0}/{1}" -f $e.Density, $name)
  }
  Write-Host ''
}

if ($fail -eq 0) { Write-Host 'ALL APK ICON CHECKS PASSED' } else { Write-Host ("FAILED: {0}" -f $fail) }
