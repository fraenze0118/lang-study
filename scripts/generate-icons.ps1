# Generate app icon + splash images (Windows / System.Drawing)
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
#
# Design: warm orange gradient rounded square + white "a" kana + two gold dots.
#   The kana is U+3042 (HIRAGANA LETTER A), the first character of the gojuuon,
#   which reads as "Japanese learning" far better than a generic chat bubble and
#   matches the product path "absolute beginner starts from the kana".
#
# This file is intentionally ASCII-only: Windows PowerShell 5.1 reads .ps1 files
# as ANSI unless they carry a UTF-8 BOM, which would corrupt non-ASCII literals.
# The glyph is therefore built from its code point instead of a literal.
#
# Output:
#   assets/icon.png            general icon (iOS / default, 1024, full bleed)
#   assets/adaptive-icon.png   Android adaptive foreground (1024, transparent, safe zone)
#   assets/splash-icon.png     splash mark (512, transparent)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null

# HIRAGANA LETTER A
$KANA = [string][char]0x3042

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Get-KanaFont([float]$px) {
  foreach ($name in @('Meiryo', 'Yu Gothic', 'Noto Sans JP', 'MS Gothic')) {
    try {
      $f = New-Object System.Drawing.Font($name, $px, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      if ($f.Name -eq $name) { return $f }
      $f.Dispose()
    } catch { }
  }
  throw 'No usable Japanese font found (Meiryo / Yu Gothic / Noto Sans JP / MS Gothic)'
}

# $size  canvas edge
# $inset rounded-square inset (0 = full bleed; adaptive foreground needs a safe zone)
# $transparentBg  true = transparent canvas, draw only the kana mark
function Draw-Icon([int]$size, [float]$inset, [bool]$transparentBg) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $box = $size - 2 * $inset

  if (-not $transparentBg) {
    $radius = $box * 0.235  # close to the iOS squircle ratio
    $bgPath = New-RoundedPath $inset $inset $box $box $radius
    $rect = New-Object System.Drawing.RectangleF($inset, $inset, $box, $box)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $rect,
      [System.Drawing.Color]::FromArgb(255, 249, 115, 22),  # #f97316
      [System.Drawing.Color]::FromArgb(255, 194, 65, 12),    # #c2410c
      55.0)
    $g.FillPath($brush, $bgPath)
    $brush.Dispose()
    $bgPath.Dispose()
  }

  $cy = $size / 2.0

  # Android crops the 108dp adaptive canvas down to ~72dp visible, so the
  # transparent foreground needs a much larger glyph in absolute terms than the
  # full-bleed icon, or it renders tiny inside the mask.
  $fontPx = if ($transparentBg) { $size * 0.44 } else { $box * 0.70 }
  $font = Get-KanaFont $fontPx
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

  # Centre the glyph's em box on the tile. A single large kana reads more
  # confidently at small sizes than glyph-plus-decoration, and avoids anything
  # near the rounded corners / adaptive-mask edge.
  $probe = $g.MeasureString($KANA, $font)
  $textH = $probe.Height
  $layout = New-Object System.Drawing.RectangleF(0, ($cy - $textH / 2.0), $size, $textH)
  $g.DrawString($KANA, $font, $white, $layout, $fmt)

  $white.Dispose(); $font.Dispose(); $g.Dispose()
  return $bmp
}

function Save-Png($bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "generated: $path"
}

Save-Png (Draw-Icon 1024 0 $false) (Join-Path $assets 'icon.png')
Save-Png (Draw-Icon 1024 0 $true) (Join-Path $assets 'adaptive-icon.png')
Save-Png (Draw-Icon 512 0 $true) (Join-Path $assets 'splash-icon.png')
