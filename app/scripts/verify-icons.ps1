# Verify the generated app icon assets.
#
# Combines everything that matters into one place, because the constraints are
# easy to get wrong and a stale check is worse than no check:
#
#  1. SAFE ZONE (the bug that shipped). An adaptive icon is a 108dp canvas but the
#     launcher only shows the centre ~72dp of it, and a round mask guarantees only
#     the inscribed circle of that window -> safe radius = canvas / 3.
#     Comparing against the full canvas inscribed circle (canvas / 2) is WRONG;
#     that mistake let the kana's corner spikes break the rounded frame.
#  2. GLYPH RATIO. The glyph should fill ~55-70% of the visible window to read at
#     launcher size - big enough to be legible, small enough not to crowd the frame.
#  3. STRAY TRANSLUCENCY. The squircle's anti-aliased edge is fine, but a
#     translucent wash outside the tile (e.g. an unclipped radial highlight) is not.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
$fail = @()

function Get-Ink([System.Drawing.Bitmap]$bmp, [scriptblock]$pred) {
  $minX = $bmp.Width; $maxX = -1; $minY = $bmp.Height; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y += 2) {
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -lt 200) { continue }
      if (& $pred $c) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  return @{ MinX = $minX; MaxX = $maxX; MinY = $minY; MaxY = $maxY }
}

$isWhite = { param($c) $c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245 }
$isOrange = { param($c) $c.R -gt 180 -and $c.R -lt 252 -and $c.G -gt 40 -and $c.G -lt 150 -and $c.B -lt 100 }

foreach ($name in @('icon', 'adaptive-icon')) {
  $path = Join-Path $assets "$name.png"
  $b = New-Object System.Drawing.Bitmap($path)
  $ink = Get-Ink $b $isWhite
  $tile = Get-Ink $b $isOrange

  $cx = $b.Width / 2.0; $cy = $b.Height / 2.0
  $safeRadius = $b.Width / 3.0
  $maxR = 0
  foreach ($p in @(@($ink.MinX, $ink.MinY), @($ink.MaxX, $ink.MinY), @($ink.MinX, $ink.MaxY), @($ink.MaxX, $ink.MaxY))) {
    $r = [Math]::Sqrt([Math]::Pow($p[0] - $cx, 2) + [Math]::Pow($p[1] - $cy, 2))
    if ($r -gt $maxR) { $maxR = $r }
  }

  "{0}  ({1}x{1})" -f $name, $b.Width
  $glyphW = $ink.MaxX - $ink.MinX
  $glyphH = $ink.MaxY - $ink.MinY
  "  glyph ink        {0}x{1}" -f $glyphW, $glyphH

  if ($name -eq 'adaptive-icon') {
    # glyph is the only content; measure against the visible window (72/108)
    $visible = $b.Width * 72.0 / 108.0
    $pct = $glyphW / $visible
    "  visible window   {0:N0}px  | glyph = {1:P0} of it" -f $visible, $pct
    if ($pct -lt 0.55 -or $pct -gt 0.70) { "$  glyph ratio outside 55-70%"; $fail += "$name ratio" }
  } else {
    $tileW = $tile.MaxX - $tile.MinX
    "  tile ink         {0}x{1}" -f $tileW, ($tile.MaxY - $tile.MinY)
  }

  "  glyph corner r   {0:N0}   safe radius {1:N0}   -> {2}" -f $maxR, $safeRadius, `
    $(if ($maxR -le $safeRadius) { 'FITS' } else { 'OVERFLOWS' })
  if ($maxR -gt $safeRadius) { $fail += "$name safe zone" }
  $b.Dispose()
  ""
}

# stray translucency outside the tile
$b = New-Object System.Drawing.Bitmap((Join-Path $assets 'icon.png'))
$minX = $b.Width; $minY = $b.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $b.Height; $y++) {
  for ($x = 0; $x -lt $b.Width; $x++) {
    if ($b.GetPixel($x, $y).A -gt 0) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
"icon opaque bounds: x[{0}..{1}] y[{2}..{3}]  (corners outside the squircle must be alpha 0)" -f $minX, $maxX, $minY, $maxY
$corner = $b.GetPixel(2, 2)
"  corner pixel alpha = {0}  -> {1}" -f $corner.A, $(if ($corner.A -eq 0) { 'transparent, OK' } else { 'STRAY INK' })
if ($corner.A -ne 0) { $fail += 'stray translucency' }
$b.Dispose()

""
if ($fail.Count -eq 0) { "ALL CHECKS PASSED" } else { "FAILED: " + ($fail -join ', ') }
