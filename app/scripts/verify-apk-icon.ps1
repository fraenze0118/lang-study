# Verify that the launcher icons packaged in the release APK are the current ones.
#
# Two traps this handles:
#  1. aapt re-encodes PNGs, so byte hashes never match -> compare decoded pixels.
#  2. Resource filenames inside an APK are obfuscated (res/xx.png) and can change
#     between builds. An earlier version of this script matched candidates by
#     pixel dimensions alone, which can silently pick the WRONG entry and report a
#     false "OK". This version resolves the real mapping from the resource table
#     with aapt2, then compares exactly those entries.
#
# On API 26+ the launcher renders mipmap-anydpi-v26/ic_launcher.xml =
# @color/iconBackground + @mipmap/ic_launcher_foreground, so the FOREGROUND is
# what actually has to be current -- not ic_launcher.png.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
$srcDir = Join-Path $root 'android\app\src\main\res'
if (-not (Test-Path $apk)) { throw "APK not found: $apk" }

$aapt2 = Get-ChildItem -Path "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Recurse -Filter 'aapt2.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $aapt2) { throw 'aapt2.exe not found in the Android SDK' }

Write-Host ("APK built: {0}" -f (Get-Item $apk).LastWriteTime)
Write-Host ("aapt2    : {0}" -f $aapt2.FullName)
Write-Host ''

# ---- resolve resource -> apk entry from the resource table ----
function Get-SystemEntries([string]$resourceName) {
  $dump = & $aapt2.FullName dump resources $apk 2>$null
  $line = $dump | Where-Object { $_ -match [regex]::Escape($resourceName) } | Select-Object -First 1
  if (-not $line) { return @() }
  $n = [array]::IndexOf($dump, $line)
  $out = @()
  for ($i = $n + 1; $i -lt [Math]::Min($n + 12, $dump.Count); $i++) {
    $l = $dump[$i].Trim()
    if ($l -match '^resource ') { break }
    if ($l -match '^\((\S+)\)\s+\(file\)\s+(\S+)') {
      $out += [pscustomobject]@{ Density = $Matches[1]; Entry = $Matches[2] }
    }
  }
  return $out
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
function Load-Entry([string]$name) {
  $e = $zip.Entries | Where-Object { $_.FullName -eq $name } | Select-Object -First 1
  if (-not $e) { return $null }
  $ms = New-Object System.IO.MemoryStream
  $s = $e.Open(); $s.CopyTo($ms); $s.Close()
  # MUST rewind: CopyTo leaves the position at the end, and FromStream on a
  # stream positioned at its end yields a garbage/incorrectly-sized bitmap.
  $ms.Position = 0
  return [System.Drawing.Bitmap]::FromStream($ms)
}

$fail = 0
function Compare-One([string]$apkEntry, [string]$srcPath, [string]$label) {
  $img = Load-Entry $apkEntry
  if (-not $img) { "  MISSING IN APK  {0} ({1})" -f $label, $apkEntry; $script:fail++; return }
  if (-not (Test-Path $srcPath)) { "  MISSING SOURCE  {0}" -f $label; $script:fail++; $img.Dispose(); return }
  $src = New-Object System.Drawing.Bitmap($srcPath)

  $sx = $img.Width / [double]$src.Width
  $sy = $img.Height / [double]$src.Height
  $step = [Math]::Max(1, [int]($src.Width / 32))
  $diff = 0; $checked = 0
  for ($y = 0; $y -lt $src.Height; $y += $step) {
    for ($x = 0; $x -lt $src.Width; $x += $step) {
      $ax = [Math]::Min($img.Width - 1, [int]($x * $sx))
      $ay = [Math]::Min($img.Height - 1, [int]($y * $sy))
      $checked++
      if ($img.GetPixel($ax, $ay).ToArgb() -ne $src.GetPixel($x, $y).ToArgb()) { $diff++ }
    }
  }
  $pct = if ($checked) { $diff / [double]$checked } else { 1 }
  $verdict = if ($pct -lt 0.02) { 'MATCHES' } else { 'DIFFERENT' }
  if ($pct -ge 0.02) { $script:fail++ }
  "  {0,-34} apk {1,4}x{2,-4} src {3,4}x{4,-4}  diff {5,6:P2}  -> {6}" -f `
    $label, $img.Width, $img.Height, $src.Width, $src.Height, $pct, $verdict
  $img.Dispose(); $src.Dispose()
}

foreach ($res in @('mipmap/ic_launcher_foreground', 'mipmap/ic_launcher')) {
  $isFg = $res -like '*foreground*'
  Write-Host ("=== {0} ===" -f $res)
  $entries = Get-SystemEntries $res
  if ($entries.Count -eq 0) { Write-Host '  no density entries resolved'; $fail++ }
  foreach ($e in $entries) {
    if ($e.Density -like 'anydpi*') { continue }
    $name = if ($isFg) { 'ic_launcher_foreground.png' } else { 'ic_launcher.png' }
    Compare-One $e.Entry (Join-Path $srcDir ("mipmap-{0}\{1}" -f $e.Density, $name)) ("{0}/{1}" -f $e.Density, $name)
  }
  Write-Host ''
}
$zip.Dispose()

if ($fail -eq 0) { Write-Host 'ALL APK ICON CHECKS PASSED' } else { Write-Host ("FAILED: {0} mismatch(es)" -f $fail) }
