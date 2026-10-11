# Regenerate Android launcher / splash resources in place, from assets/icon.png.
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate-android-res.ps1
#
# WHY THIS EXISTS: `expo prebuild --clean` needs to delete the android/ directory
# first, and that directory can be held by an external handle on Windows. This
# script rewrites only the generated bitmap resources, so a local gradle build
# picks up a new icon without regenerating the whole native project.
#
# The adaptive-icon foreground is measured rather than assumed: the glyph's ink
# bounding box is located on the source silhouette, then scaled so the ink fills
# 66% of the 108dp viewport (Android's guaranteed-visible area).
#
# ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$srcIcon = Join-Path $root 'assets\icon.png'
$res = Join-Path $root 'android\app\src\main\res'

if (-not (Test-Path $srcIcon)) { throw "missing source icon: $srcIcon" }
if (-not (Test-Path $res)) { throw "missing android res dir: $res" }

# Android density buckets: mipmap-<bucket>, and the legacy launcher size in px.
$LAUNCHER = [ordered]@{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
$FOREGROUND = [ordered]@{ 'mdpi' = 108; 'hdpi' = 162; 'xhdpi' = 216; 'xxhdpi' = 324; 'xxxhdpi' = 432 }
$SPLASH = [ordered]@{ 'mdpi' = 288; 'hdpi' = 432; 'xhdpi' = 576; 'xxhdpi' = 864; 'xxxhdpi' = 1152 }

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcIcon))

function Save-AsWebP($bmp, [string]$path) {
  # System.Drawing has no WebP encoder; Android compiles PNG from mipmap/drawable
  # just as well. Write .png and DELETE any same-named .webp left by the previous
  # prebuild: two files resolving to the same resource name is a duplicate-resource
  # build error.
  $target = [System.IO.Path]::ChangeExtension($path, '.png')
  $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $w = $bmp.Width; $h = $bmp.Height
  $bmp.Dispose()

  $stale = [System.IO.Path]::ChangeExtension($path, '.webp')
  if (Test-Path $stale) { Remove-Item -LiteralPath $stale -Force }

  Write-Host "  wrote $([System.IO.Path]::GetFileName($target)) ${w}x${h}"
}

function New-ScaledBitmap([System.Drawing.Bitmap]$source, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($source, 0, 0, $size, $size)
  $g.Dispose()
  return $bmp
}

# --- 1. sanity check: the source must have a light glyph on a dark tile ---
$probeCorner = $src.GetPixel(4, 4)
Write-Host ("source corner RGB=({0},{1},{2})" -f $probeCorner.R, $probeCorner.G, $probeCorner.B)

function Get-KanaFont([float]$px) {
  foreach ($name in @('Meiryo', 'Yu Gothic', 'Noto Sans JP', 'MS Gothic')) {
    try {
      $f = New-Object System.Drawing.Font($name, $px, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      if ($f.Name -eq $name) { return $f }
      $f.Dispose()
    } catch { }
  }
  throw 'No usable Japanese font found'
}

$KANA = [string][char]0x3042

# Calibrate ONCE on a small canvas: find the font size whose rendered ink box is
# $targetFrac of the canvas width, then return the ink-per-font ratio. The ratio is
# scale-invariant, so each density just multiplies it -- calibrating per density
# would mean scanning huge bitmaps pixel by pixel in PowerShell.
$CAL_SIZE = 240
$CAL_TARGET = 0.5
function Get-InkPerFontRatio {
  $targetInk = $CAL_SIZE * $CAL_TARGET
  $fontPx = $CAL_SIZE * 0.7
  for ($iter = 0; $iter -lt 8; $iter++) {
    $bmp = New-Object System.Drawing.Bitmap($CAL_SIZE, $CAL_SIZE, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    $font = Get-KanaFont $fontPx
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $probe = $g.MeasureString($KANA, $font)
    $layout = New-Object System.Drawing.RectangleF(0, (($CAL_SIZE - $probe.Height) / 2.0), $CAL_SIZE, $probe.Height)
    $g.DrawString($KANA, $font, $brush, $layout, $fmt)
    $brush.Dispose(); $font.Dispose(); $g.Dispose()

    $minX = $CAL_SIZE; $maxX = -1
    for ($y = 0; $y -lt $CAL_SIZE; $y++) {
      for ($x = 0; $x -lt $CAL_SIZE; $x++) {
        if ($bmp.GetPixel($x, $y).A -gt 128) {
          if ($x -lt $minX) { $minX = $x }
          if ($x -gt $maxX) { $maxX = $x }
        }
      }
    }
    $bmp.Dispose()
    if ($maxX -lt 0) { throw 'glyph rendered nothing while calibrating' }
    $ink = $maxX - $minX + 1
    if ([Math]::Abs($ink - $targetInk) -le 1) {
      Write-Host ("calibrated: fontPx={0:N1} ink={1} target={2:N1}" -f $fontPx, $ink, $targetInk)
      return $ink / $fontPx
    }
    $fontPx = $fontPx * ($targetInk / $ink)
  }
  throw 'font calibration did not converge'
}

$INK_PER_FONT = Get-InkPerFontRatio

function Draw-KanaMark([int]$size, [float]$targetFrac, [bool]$orangeBackground) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($orangeBackground) {
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.RectangleF(0, 0, $size, $size)),
      [System.Drawing.Color]::FromArgb(255, 249, 115, 22),
      [System.Drawing.Color]::FromArgb(255, 194, 65, 12),
      55.0)
    $g.FillRectangle($grad, 0, 0, $size, $size)
    $grad.Dispose()
  }

  $font = Get-KanaFont (($size * $targetFrac) / $INK_PER_FONT)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $probe = $g.MeasureString($KANA, $font)
  $layout = New-Object System.Drawing.RectangleF(0, (($size - $probe.Height) / 2.0), $size, $probe.Height)
  $g.DrawString($KANA, $font, $white, $layout, $fmt)
  $white.Dispose(); $font.Dispose(); $g.Dispose()
  return $bmp
}

# --- 2. adaptive foreground: white kana on transparent, ink = 66% of viewport ---
foreach ($bucket in $FOREGROUND.Keys) {
  $size = $FOREGROUND[$bucket]
  Save-AsWebP (Draw-KanaMark $size 0.66 $false) (Join-Path $res "mipmap-$bucket\ic_launcher_foreground.webp")
}

# --- 3. legacy square + round launcher icons, scaled from the full-bleed source ---
foreach ($bucket in $LAUNCHER.Keys) {
  $size = $LAUNCHER[$bucket]
  Save-AsWebP (New-ScaledBitmap $src $size) (Join-Path $res "mipmap-$bucket\ic_launcher.webp")
  Save-AsWebP (New-ScaledBitmap $src $size) (Join-Path $res "mipmap-$bucket\ic_launcher_round.webp")
}

# --- 4. splash logo: white kana on the orange tile ---
foreach ($bucket in $SPLASH.Keys) {
  $size = $SPLASH[$bucket]
  Save-AsWebP (Draw-KanaMark $size 0.30 $true) (Join-Path $res "drawable-$bucket\splashscreen_logo.png")
}

$src.Dispose()
Write-Host 'done.'
