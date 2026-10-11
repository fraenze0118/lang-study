# Copy the prepared icon assets into the Android native resource tree, in place.
#
#   powershell -ExecutionPolicy Bypass -File scripts/generate-android-res.ps1
#
# WHY THIS EXISTS: `expo prebuild --clean` has to delete android/ first, and that
# directory can be held by an external handle on Windows. This script rewrites
# only the bitmap resources, so a local gradle build picks up new icons without
# regenerating the whole native project.
#
# SOURCE OF TRUTH is the three files produced by make-icon-from-art.ps1:
#   assets/icon.png           -> mipmap-*/ic_launcher(.png) + ic_launcher_round
#   assets/adaptive-icon.png  -> mipmap-*/ic_launcher_foreground
#   assets/splash-icon.png    -> drawable-*/splashscreen_logo
#
# HISTORY / WHY THIS WAS REWRITTEN: an earlier version of this script did not read
# assets/adaptive-icon.png at all -- it re-drew the white kana glyph from scratch
# with System.Drawing and used that as the adaptive foreground and splash logo.
# So changing assets/ updated the legacy ic_launcher but silently left the
# adaptive foreground on the OLD artwork, which is what a modern Android launcher
# actually displays. Every asset is now copied from its prepared file, so what you
# see in assets/ is exactly what ships.
#
# ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$assets = Join-Path $root 'assets'
$res = Join-Path $root 'android\app\src\main\res'

$srcIcon = Join-Path $assets 'icon.png'
$srcAdaptive = Join-Path $assets 'adaptive-icon.png'
$srcSplash = Join-Path $assets 'splash-icon.png'

foreach ($p in @($srcIcon, $srcAdaptive, $srcSplash)) {
  if (-not (Test-Path $p)) { throw "missing prepared asset: $p" }
}
if (-not (Test-Path $res)) { throw "missing android res dir: $res" }

# Android density buckets -> target pixel size for each asset kind.
$LAUNCHER = [ordered]@{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
$FOREGROUND = [ordered]@{ 'mdpi' = 108; 'hdpi' = 162; 'xhdpi' = 216; 'xxhdpi' = 324; 'xxxhdpi' = 432 }
$SPLASH = [ordered]@{ 'mdpi' = 288; 'hdpi' = 432; 'xhdpi' = 576; 'xxhdpi' = 864; 'xxxhdpi' = 1152 }

function Save-Resized([System.Drawing.Bitmap]$source, [int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($source, 0, 0, $size, $size)
  $g.Dispose()

  # System.Drawing has no WebP encoder; Android compiles PNG from mipmap/drawable
  # just as well. Write .png and DELETE any same-named .webp left by a previous
  # prebuild: two files resolving to the same resource name is a duplicate-resource
  # build error.
  $target = [System.IO.Path]::ChangeExtension($path, '.png')
  $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()

  $stale = [System.IO.Path]::ChangeExtension($path, '.webp')
  if (Test-Path $stale) { Remove-Item -LiteralPath $stale -Force }

  Write-Host "  wrote $([System.IO.Path]::GetFileName($target)) ${size}x${size}"
}

# NOTE: PowerShell variable names are CASE-INSENSITIVE, so a bitmap called
# $splash would silently clobber the $SPLASH bucket dictionary defined above --
# after which `$SPLASH.Keys` enumerates nothing and the splash loop body never
# runs. Keep the bitmaps suffixed to avoid colliding with the bucket tables.
$iconBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcIcon))
$adaptiveBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcAdaptive))
$splashBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcSplash))

Write-Host 'legacy launcher icons (from assets/icon.png)'
foreach ($bucket in $LAUNCHER.Keys) {
  $size = $LAUNCHER[$bucket]
  Save-Resized $iconBmp $size (Join-Path $res "mipmap-$bucket\ic_launcher.webp")
  Save-Resized $iconBmp $size (Join-Path $res "mipmap-$bucket\ic_launcher_round.webp")
}

Write-Host 'adaptive foreground (from assets/adaptive-icon.png)'
foreach ($bucket in $FOREGROUND.Keys) {
  Save-Resized $adaptiveBmp $FOREGROUND[$bucket] (Join-Path $res "mipmap-$bucket\ic_launcher_foreground.webp")
}

Write-Host 'splash logo (from assets/splash-icon.png)'
foreach ($bucket in $SPLASH.Keys) {
  Save-Resized $splashBmp $SPLASH[$bucket] (Join-Path $res "drawable-$bucket\splashscreen_logo.png")
}

$iconBmp.Dispose(); $adaptiveBmp.Dispose(); $splashBmp.Dispose()
Write-Host 'done.'
