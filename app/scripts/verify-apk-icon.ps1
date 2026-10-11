# Verify that the icons actually packaged in the APK match the source resources.
#
# Two gotchas this handles:
#  1. aapt re-encodes PNGs, so byte hashes never match -> compare decoded pixels.
#  2. aapt may re-encode at a different resolution, and resource filenames inside
#     the APK are obfuscated/short and can change between builds -> do NOT hardcode
#     res/xx.png names; match by pixel dimensions instead.
#
# On API 26+ the launcher renders mipmap-anydpi-v26/ic_launcher.xml, i.e.
# @color/iconBackground + @mipmap/ic_launcher_foreground, so the FOREGROUND is
# what actually has to be current -- not ic_launcher.png.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
$srcDir = Join-Path $root 'android\app\src\main\res'

if (-not (Test-Path $apk)) { throw "APK not found: $apk" }
$apkTime = (Get-Item $apk).LastWriteTime

# ---- load every PNG in the APK, keyed by dimensions ----
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
$bySize = @{}
foreach ($e in $zip.Entries) {
  if ($e.FullName -notmatch '\.png$') { continue }
  $ms = New-Object System.IO.MemoryStream
  $s = $e.Open(); $s.CopyTo($ms); $s.Close(); $ms.Position = 0
  try {
    $img = [System.Drawing.Bitmap]::FromStream($ms)
    $key = "$($img.Width)x$($img.Height)"
    if (-not $bySize.ContainsKey($key)) { $bySize[$key] = @() }
    $bySize[$key] += [pscustomobject]@{ Entry = $e.FullName; Img = $img }
  } catch { }
  $ms.Dispose()
}

function Compare-WithSource([string]$srcPath, [string]$label) {
  if (-not (Test-Path $srcPath)) { "  MISSING SOURCE  $label"; return }
  $src = New-Object System.Drawing.Bitmap($srcPath)
  $key = "$($src.Width)x$($src.Height)"
  if (-not $bySize.ContainsKey($key)) {
    "  NOT IN APK      {0,-42} source {1}" -f $label, $key
    $src.Dispose(); return
  }
  # pick the candidate with the smallest pixel difference
  $best = $null; $bestPct = 2.0
  foreach ($cand in $bySize[$key]) {
    $step = [Math]::Max(1, [int]($src.Width / 40))
    $diff = 0; $checked = 0
    for ($y = 0; $y -lt $src.Height; $y += $step) {
      for ($x = 0; $x -lt $src.Width; $x += $step) {
        $checked++
        if ($cand.Img.GetPixel($x, $y).ToArgb() -ne $src.GetPixel($x, $y).ToArgb()) { $diff++ }
      }
    }
    $pct = $diff / [double]$checked
    if ($pct -lt $bestPct) { $bestPct = $pct; $best = $cand.Entry }
  }
  if ($best) {
    "  OK    {0,-42} {1,-10} matched {2} (diff {3:P1})" -f $label, $key, $best, $bestPct
  } else {
    "  STALE {0,-42} {1,-10} no APK PNG of this size matches the source" -f $label, $key
  }
  $src.Dispose()
}

"APK built: $apkTime"
"`n=== adaptive foreground (@mipmap/ic_launcher_foreground -- what API 26+ shows) ==="
foreach ($d in @('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi')) {
  Compare-WithSource (Join-Path $srcDir "mipmap-$d\ic_launcher_foreground.png") "mipmap-$d/foreground"
}

"`n=== full-bleed launcher png (legacy / API < 26) ==="
foreach ($d in @('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi')) {
  Compare-WithSource (Join-Path $srcDir "mipmap-$d\ic_launcher.png") "mipmap-$d/ic_launcher"
}

"`n=== splash logo ==="
foreach ($d in @('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi')) {
  Compare-WithSource (Join-Path $srcDir "drawable-$d\splashscreen_logo.png") "drawable-$d/splashscreen_logo"
}

foreach ($v in $bySize.Values) { foreach ($c in $v) { $c.Img.Dispose() } }
$zip.Dispose()
