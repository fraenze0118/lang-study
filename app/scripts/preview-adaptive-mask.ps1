# Render what an Android launcher actually shows for the adaptive icon:
#   foreground PNG (108dp canvas) -> crop to the visible window -> apply a mask.
#
# Note: Graphics.Clear() IGNORES the clip region, so it cannot be used to paint a
# masked area. Everything inside the clip must be drawn with FillRectangle/DrawImage.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
$outDir = Join-Path $env:TEMP 'icon-preview'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$fg = New-Object System.Drawing.Bitmap((Join-Path $assets 'adaptive-icon.png'))
$size = $fg.Width                                              # 1024 px == 108dp
$bg = [System.Drawing.Color]::FromArgb(255, 234, 88, 12)       # #ea580c (app.json)

$visibleFrac = 72.0 / 108.0
$vis = [int]($size * $visibleFrac)
$off = [int](($size - $vis) / 2)

function New-MaskPath([string]$mask, [int]$s) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  switch ($mask) {
    'circle' { $p.AddEllipse(0, 0, $s, $s) }
    'squircle' {
      $r = [int]($s * 0.235); $d = $r * 2
      $p.AddArc(0, 0, $d, $d, 180, 90)
      $p.AddArc($s - $d, 0, $d, $d, 270, 90)
      $p.AddArc($s - $d, $s - $d, $d, $d, 0, 90)
      $p.AddArc(0, $s - $d, $d, $d, 90, 90)
      $p.CloseFigure()
    }
    'square' { $p.AddRectangle((New-Object System.Drawing.Rectangle(0, 0, $s, $s))) }
    'teardrop' {
      # Android also ships a "rounded rectangle"/squircle-ish mask; approximate with a big radius
      $r = [int]($s * 0.42); $d = $r * 2
      $p.AddArc(0, 0, $d, $d, 180, 90)
      $p.AddArc($s - $d, 0, $d, $d, 270, 90)
      $p.AddArc($s - $d, $s - $d, $d, $d, 0, 90)
      $p.AddArc(0, $s - $d, $d, $d, 90, 90)
      $p.CloseFigure()
    }
  }
  return $p
}

function Render-Masked([string]$mask, [string]$outName) {
  $layer = New-Object System.Drawing.Bitmap($vis, $vis, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($layer)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $path = New-MaskPath $mask $vis
  $g.SetClip($path)
  # Draw the adaptive foreground itself (already includes its own opaque
  # background fill). Do NOT re-composite the source artwork here: its background
  # is a gradient, so scaling it onto a flat fill would show a seam that the real
  # launcher never produces.
  $dest = New-Object System.Drawing.Rectangle(0, 0, $vis, $vis)
  $src = New-Object System.Drawing.Rectangle($off, $off, $vis, $vis)
  $g.DrawImage($fg, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $g.ResetClip()
  $g.Dispose()

  # flatten onto light grey so the mask silhouette is legible
  $flat = New-Object System.Drawing.Bitmap($vis, $vis)
  $g2 = [System.Drawing.Graphics]::FromImage($flat)
  $g2.Clear([System.Drawing.Color]::FromArgb(255, 226, 229, 234))
  $g2.DrawImage($layer, 0, 0)
  $g2.Dispose()

  $p = Join-Path $outDir "$outName.png"
  $flat.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  "saved $p  ({0}x{1}, mask={2})" -f $vis, $vis, $mask
  $layer.Dispose(); $flat.Dispose(); $path.Dispose()
}

$masks = @('circle', 'squircle', 'teardrop', 'square')
foreach ($m in $masks) { Render-Masked $m "mask-$m" }

# contact sheet: circle | squircle | teardrop | square
$imgs = $masks | ForEach-Object { New-Object System.Drawing.Bitmap((Join-Path $outDir "mask-$_.png")) }
$gap = 14
$stripW = [int]($vis * 4 + $gap * 5)
$stripH = [int]($vis + $gap * 2)
$strip = New-Object System.Drawing.Bitmap($stripW, $stripH)
$gs = [System.Drawing.Graphics]::FromImage($strip)
$gs.Clear([System.Drawing.Color]::White)
for ($i = 0; $i -lt 4; $i++) {
  $gs.DrawImage($imgs[$i], [int]($gap + $i * ($vis + $gap)), $gap)
}
$gs.Dispose()
$stripPath = Join-Path $outDir 'masks-strip.png'
$strip.Save($stripPath, [System.Drawing.Imaging.ImageFormat]::Png)
"saved $stripPath  (circle | squircle | teardrop | square)"
$strip.Dispose(); $imgs | ForEach-Object { $_.Dispose() }; $fg.Dispose()
