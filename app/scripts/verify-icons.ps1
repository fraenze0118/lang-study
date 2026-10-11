# Verify icon assets for a design where the artwork is a FULL-BLEED opaque orange
# square (no rounded corners of its own).
#
# Design assumptions this encodes (they changed when the artwork changed, so the
# checks had to change with them):
#   icon.png / splash-icon.png : solid full-bleed orange. Opaque corners are
#     CORRECT here -- the OS applies its own mask, and a transparent corner would
#     show the launcher wallpaper through.
#   adaptive-icon.png          : opaque too, pre-filled with the artwork's own
#     background colour. That is deliberate: it stops app.json's slightly
#     different backgroundColor from showing as a ring at the artwork's edge.
#     What matters is that the CONTENT stays inside the mask-safe circle
#     (radius = canvas/3) so no launcher mask clips it.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
$fail = @()

function Test-FlatOrange($c) {
  # the artwork's own background: warm orange, red-dominant, low blue
  $d = [Math]::Abs($c.R - 252) + [Math]::Abs($c.G - 121) + [Math]::Abs($c.B - 19)
  return ($d -lt 60) -and ($c.R -gt 200)
}

function Get-ContentBounds([System.Drawing.Bitmap]$bmp) {
  $minX = $bmp.Width; $maxX = -1; $minY = $bmp.Height; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y += 2) {
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
      $c = $bmp.GetPixel($x, $y)
      if (Test-FlatOrange $c) { continue }
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
  if ($maxX -lt 0) { return $null }
  return @{ MinX = $minX; MaxX = $maxX; MinY = $minY; MaxY = $maxY }
}

# ---------- icon.png ----------
"icon.png"
$b = New-Object System.Drawing.Bitmap((Join-Path $assets 'icon.png'))
"  size {0}x{1}" -f $b.Width, $b.Height
if ($b.Width -ne 1024 -or $b.Height -ne 1024) { $fail += 'icon not 1024' }

$lastX = $b.Width - 3; $lastY = $b.Height - 3
$midX = [int]($b.Width / 2); $midY = [int]($b.Height / 2)
$solid = 1.0
foreach ($p in @([int[]]@(2, 2), [int[]]@($lastX, 2), [int[]]@(2, $lastY), [int[]]@($lastX, $lastY),
                 [int[]]@($midX, 2), [int[]]@($midX, $lastY), [int[]]@(2, $midY), [int[]]@($lastX, $midY))) {
  if ($b.GetPixel($p[0], $p[1]).A -lt 250) { $solid = 0 }
}
"  fully opaque edge to edge -> {0}" -f $(if ($solid -eq 1) { 'yes' } else { 'NO (gaps)' })
if ($solid -ne 1) { $fail += 'icon has transparent edges' }
$b.Dispose()
""

# ---------- adaptive-icon.png ----------
"adaptive-icon.png"
$b = New-Object System.Drawing.Bitmap((Join-Path $assets 'adaptive-icon.png'))
$safeR = $b.Width / 3.0
$cx = $b.Width / 2.0; $cy = $b.Height / 2.0

# The whole canvas is opaque by design; check that no CONTENT pixel lies outside
# the safe circle. Content = everything that is not the flat background.
$outside = 0; $inside = 0
for ($y = 0; $y -lt $b.Height; $y++) {
  for ($x = 0; $x -lt $b.Width; $x++) {
    $c = $b.GetPixel($x, $y)
    if (Test-FlatOrange $c) { continue }
    $r = [Math]::Sqrt([Math]::Pow($x - $cx, 2) + [Math]::Pow($y - $cy, 2))
    if ($r -gt $safeR) { $outside++ } else { $inside++ }
  }
}
$tot = $inside + $outside
"  content pixels: {0} inside safe circle, {1} outside" -f $inside, $outside
if ($tot -gt 0) { "  clipped by a round mask: {0:P2}" -f ($outside / [double]$tot) }
if ($outside -gt 0) { $fail += 'adaptive content outside safe circle' }

$cb = Get-ContentBounds $b
if ($cb) {
  $w = $cb.MaxX - $cb.MinX + 1; $h = $cb.MaxY - $cb.MinY + 1
  "  content box {0}x{1} centred at ({2},{3}) vs canvas centre ({4},{5})" -f `
    $w, $h, [int](($cb.MinX + $cb.MaxX) / 2), [int](($cb.MinY + $cb.MaxY) / 2), [int]$cx, [int]$cy
}
$b.Dispose()
""

# ---------- splash-icon.png ----------
"splash-icon.png"
$b = New-Object System.Drawing.Bitmap((Join-Path $assets 'splash-icon.png'))
"  size {0}x{1}, corner alpha {2}" -f $b.Width, $b.Height, $b.GetPixel(2, 2).A
$b.Dispose()
""

if ($fail.Count -eq 0) { "ALL CHECKS PASSED" } else { "FAILED: " + ($fail -join ', ') }
