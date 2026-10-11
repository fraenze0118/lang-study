# Generate app icon + splash images (Windows / System.Drawing)
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
#
# Design v2 (fixes the "kana outgrew its frame" problem):
#   The previous version drew the glyph at box*0.70 with inset=0, so the stroke
#   ran into the rounded corners and the mark read as "letter crammed in a square".
#   v2 instead:
#     - glyph at ~50% of the tile, leaving a real margin on all sides
#     - soft drop shadow under the glyph for depth (was flat white on flat orange)
#     - gradient re-aimed top-left light -> bottom-right deep, so it no longer
#       fights the warm background in the lower-right
#     - radius raised to the iOS squircle ratio
#
# The kana is U+3042 (HIRAGANA LETTER A): the first character of the gojuuon,
# which reads as "Japanese learning" and matches the beginner path.
#
# This file is intentionally ASCII-only: Windows PowerShell 5.1 reads .ps1 files
# as ANSI unless they carry a UTF-8 BOM, which would corrupt non-ASCII literals.
# The glyph is therefore built from its code point instead of a literal.
#
# Output:
#   assets/icon.png            general icon (iOS / default, 1024, full bleed)
#   assets/adaptive-icon.png   Android adaptive foreground (1024, transparent, safe zone)
#   assets/splash-icon.png     splash mark (512, transparent)
#   assets/icon-48.png         legibility proof at launcher size (not shipped)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null

# HIRAGANA LETTER A
$KANA = [string][char]0x3042

# Palette: matches theme.colors.primary (#ea580c) / primaryDeep (#c2410c)
$C_TOP    = [System.Drawing.Color]::FromArgb(255, 251, 146, 60)   # light warm
$C_BOTTOM = [System.Drawing.Color]::FromArgb(255, 194, 65, 12)    # deep orange

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
# $transparentBg  true = transparent canvas, draw only the kana mark (adaptive foreground)
# $glyphRatio  glyph font size as a fraction of the tile edge
# $dyRatio  vertical nudge as a fraction of the tile edge. Kana sit high in their
#           em box (measured: optical centre ~68px above canvas centre at 1024),
#           so a small downward nudge is needed to look centred.
function Draw-Icon([int]$size, [bool]$transparentBg, [float]$glyphRatio, [float]$dyRatio) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  if (-not $transparentBg) {
    $radius = $size * 0.235  # iOS squircle ratio
    $bgPath = New-RoundedPath 0 0 $size $size $radius
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    # 115 degrees: light at top-left, deep at bottom-right
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $C_TOP, $C_BOTTOM, 115.0)
    $g.FillPath($brush, $bgPath)
    $brush.Dispose()

    # Soft radial highlight top-left for depth.
    # IMPORTANT: clip to the squircle first. The ellipse is centred outside the
    # canvas, so without clipping its translucent edge spills into the corners
    # OUTSIDE the rounded background -- visible as a white haze on the
    # transparent corners.
    $state = $g.Save()
    $g.SetClip($bgPath)
    $hl = New-Object System.Drawing.Drawing2D.GraphicsPath
    $hlR = $size * 0.62
    $hl.AddEllipse(-$hlR * 0.30, -$hlR * 0.34, $hlR, $hlR)
    $hlBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($hl)
    $hlBrush.CenterColor = [System.Drawing.Color]::FromArgb(30, 255, 255, 255)
    $hlBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $g.FillPath($hlBrush, $hl)
    $hlBrush.Dispose(); $hl.Dispose()
    $g.Restore($state)
    $bgPath.Dispose()
  }

  $fontPx = $size * $glyphRatio
  $font = Get-KanaFont $fontPx
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

  # Measure, then centre the *ink*, not the em box: DrawString on a full-height
  # layout rect leaves the leading on one side and makes the mark sit low.
  $probe = $g.MeasureString($KANA, $font)
  $cy = $size / 2.0 + $size * $dyRatio
  $layout = New-Object System.Drawing.RectangleF(0, ($cy - $probe.Height / 2.0), $size, $probe.Height)

  if (-not $transparentBg) {
    # Soft shadow: offset down, semi-transparent black
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(46, 90, 20, 0))
    $sLayout = New-Object System.Drawing.RectangleF(0, ($cy - $probe.Height / 2.0 + $size * 0.012), $size, $probe.Height)
    $g.DrawString($KANA, $font, $shadow, $sLayout, $fmt)
    $shadow.Dispose()
  }

  # The adaptive foreground is drawn on a transparent canvas and composited onto
  # the launcher's solid background, so it must be a flat cut-out: a drop shadow
  # here would show as a grey smear around the glyph.
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.DrawString($KANA, $font, $white, $layout, $fmt)

  $white.Dispose(); $font.Dispose(); $g.Dispose()
  return $bmp
}

function Save-Png($bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "generated: $path"
}

# Full-bleed general icon: glyph ~56% of the canvas, nudged down to sit optically centred
Save-Png (Draw-Icon 1024 $false 0.56 0.030) (Join-Path $assets 'icon.png')
# Android crops the 108dp adaptive canvas down to ~72dp visible, so the foreground
# glyph has to be ~1.44x larger in absolute terms than the full-bleed one to look
# the same size on the launcher (0.56 * 1.44 ~= 0.81). Getting this wrong is why
# adaptive icons usually render tiny inside the mask.
Save-Png (Draw-Icon 1024 $true 0.81 0.030) (Join-Path $assets 'adaptive-icon.png')
Save-Png (Draw-Icon 512 $true 0.81 0.030) (Join-Path $assets 'splash-icon.png')

# Legibility proof: downsample the finished icon to launcher size.
$full = [System.Drawing.Image]::FromFile((Join-Path $assets 'icon.png'))
$small = New-Object System.Drawing.Bitmap(48, 48)
$sg = [System.Drawing.Graphics]::FromImage($small)
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sg.DrawImage($full, 0, 0, 48, 48)
$sg.Dispose(); $full.Dispose()
Save-Png $small (Join-Path $assets 'icon-48.png')
