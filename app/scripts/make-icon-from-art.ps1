# Build launcher-ready icon assets from the supplied mascot artwork.
#
# This revision of the artwork is already what a launcher icon wants:
#   - full-bleed orange gradient background (no beige page, no inset tile)
#   - warm palette aligned with the app
#   - no rounded corners of its own, so no "double frame" risk
# so there is NO recolouring, cropping or cut-out step. The work is limited to
# resizing into the three shapes the project needs plus a legibility proof.
#
# The only subtlety is the adaptive foreground: Android shows the middle ~72/108
# of that canvas and a round mask guarantees only the inscribed circle of that
# window, so the artwork has to be scaled down and the leftover margin filled with
# a colour that matches the artwork's OWN background (not app.json's
# backgroundColor, which is a slightly different orange and would show a ring).
#
# ASCII-only: Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$src = Join-Path $root 'assets\src\mascot-source.png'
$assets = Join-Path $root 'assets'

if (-not (Test-Path $src)) { throw "source artwork missing: $src" }

$bmp = New-Object System.Drawing.Bitmap($src)
$W = $bmp.Width
$H = $bmp.Height
Write-Host ("source: {0}x{1}" -f $W, $H)

$hi = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$px = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# --- artwork bounds (pixels differing from the flat background) -------------
# The artwork's background is a soft GRADIENT, so no single flat fill can match it
# everywhere. Averaging the whole border gives the least-wrong constant: sampling
# only the top edge biased the fill light and left a faint seam (R matched, G off
# by ~10) along the other edges.
function Get-BgColour([System.Drawing.Bitmap]$b) {
  $r = 0; $g = 0; $bl = 0; $n = 0
  for ($x = 0; $x -lt $b.Width; $x += 2) {
    foreach ($y in @(2, ($b.Height - 3))) {
      $c = $b.GetPixel($x, $y); $r += $c.R; $g += $c.G; $bl += $c.B; $n++
    }
  }
  for ($y = 0; $y -lt $b.Height; $y += 2) {
    foreach ($x in @(2, ($b.Width - 3))) {
      $c = $b.GetPixel($x, $y); $r += $c.R; $g += $c.G; $bl += $c.B; $n++
    }
  }
  return @([int]($r / $n), [int]($g / $n), [int]($bl / $n))
}
$bg = Get-BgColour $bmp
Write-Host ("background colour (mean of all four edges): #{0:X2}{1:X2}{2:X2}" -f $bg[0], $bg[1], $bg[2])

$minX = $W; $maxX = -1; $minY = $H; $maxY = -1
for ($y = 0; $y -lt $H; $y += 2) {
  for ($x = 0; $x -lt $W; $x += 2) {
    $c = $bmp.GetPixel($x, $y)
    $d = [Math]::Abs($c.R - $bg[0]) + [Math]::Abs($c.G - $bg[1]) + [Math]::Abs($c.B - $bg[2])
    if ($d -gt 45) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$aw = $maxX - $minX + 1
$ah = $maxY - $minY + 1
Write-Host ("artwork bounds: {0}x{1} at ({2},{3})" -f $aw, $ah, $minX, $minY)

# --- 1. full-bleed general icon (1024) -------------------------------------
# The source is already full-bleed, so a straight resize is all that is needed.
$icon = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.InterpolationMode = $hi
$g.PixelOffsetMode = $px
$g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)))
$g.Dispose()
$icon.Save((Join-Path $assets 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host 'wrote icon.png (1024, full bleed)'

# --- 2. adaptive foreground ------------------------------------------------
# Scale the artwork so its half-diagonal fits the mask-safe circle
# (safe radius = canvas / 3), then fill the margin with the artwork's own
# background colour so no ring is visible. The fill must be OPAQUE: leaving it
# transparent would expose app.json's backgroundColor, a slightly different
# orange, right where the artwork's edge is -- which reads as a nested tile.
$canvas = 1024
$safeR = $canvas / 3.0
$halfDiag = [Math]::Sqrt(($aw / 2.0) * ($aw / 2.0) + ($ah / 2.0) * ($ah / 2.0))
$target = $safeR * 0.90
$scale = $target / $halfDiag
$dw = [int]($aw * $scale)
$dh = [int]($ah * $scale)
# centre the artwork itself, not the source canvas
$artCx = $minX + $aw / 2.0
$artCy = $minY + $ah / 2.0
$dx = [int]($canvas / 2.0 - ($artCx * $scale))
$dy = [int]($canvas / 2.0 - ($artCy * $scale))
$drawW = [int]($W * $scale)
$drawH = [int]($H * $scale)

$fg = New-Object System.Drawing.Bitmap($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($fg)
$g.InterpolationMode = $hi
$g.PixelOffsetMode = $px
$g.Clear([System.Drawing.Color]::FromArgb(255, $bg[0], $bg[1], $bg[2]))
$g.DrawImage($bmp, (New-Object System.Drawing.Rectangle($dx, $dy, $drawW, $drawH)))
$g.Dispose()
$fg.Save((Join-Path $assets 'adaptive-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ("wrote adaptive-icon.png (artwork {0}x{1}, canvas filled #{2:X2}{3:X2}{4:X2})" -f $dw, $dh, $bg[0], $bg[1], $bg[2])

# --- 3. splash mark (512) --------------------------------------------------
# Also opaque + matching fill: a transparent mark would show the splash screen's
# own background colour through, which again differs by a shade.
$sp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sp)
$g.InterpolationMode = $hi
$g.PixelOffsetMode = $px
$g.Clear([System.Drawing.Color]::FromArgb(255, $bg[0], $bg[1], $bg[2]))
$g.DrawImage($fg, (New-Object System.Drawing.Rectangle(0, 0, 512, 512)))
$g.Dispose()
$sp.Save((Join-Path $assets 'splash-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host 'wrote splash-icon.png (512)'

# --- 4. launcher-size legibility proof -------------------------------------
$sm = New-Object System.Drawing.Bitmap(48, 48)
$g = [System.Drawing.Graphics]::FromImage($sm)
$g.InterpolationMode = $hi
$g.DrawImage($icon, (New-Object System.Drawing.Rectangle(0, 0, 48, 48)))
$g.Dispose()
$sm.Save((Join-Path $assets 'icon-48.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host 'wrote icon-48.png (48, proof only)'

$bmp.Dispose(); $icon.Dispose(); $fg.Dispose(); $sp.Dispose(); $sm.Dispose()
Write-Host 'done.'
