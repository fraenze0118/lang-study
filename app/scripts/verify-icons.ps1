# Verify the shipped icon assets: size, ink coverage, and that neither the
# full-bleed icon nor the adaptive foreground has stray translucent pixels.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

foreach ($f in @('icon', 'adaptive-icon', 'splash-icon', 'icon-48')) {
  $p = Join-Path $PSScriptRoot "..\assets\$f.png"
  $b = New-Object System.Drawing.Bitmap($p)
  $white = 0; $opaque = 0; $translucent = 0
  for ($y = 0; $y -lt $b.Height; $y += 4) {
    for ($x = 0; $x -lt $b.Width; $x += 4) {
      $c = $b.GetPixel($x, $y)
      if ($c.A -gt 200) {
        $opaque++
        if ($c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245) { $white++ }
      } elseif ($c.A -gt 0) {
        $translucent++
      }
    }
  }
  "{0,-15} {1,4}x{2,-4}  glyph-ink {3,-6} translucent {4}" -f $f, $b.Width, $b.Height, $white, $translucent
  $b.Dispose()
}

# Confirm the general icon's ink stays inside the inscribed circle (round launcher safety)
$b = New-Object System.Drawing.Bitmap((Join-Path $PSScriptRoot '..\assets\icon.png'))
$minX = $b.Width; $maxX = -1; $minY = $b.Height; $maxY = -1
for ($y = 0; $y -lt $b.Height; $y += 2) {
  for ($x = 0; $x -lt $b.Width; $x += 2) {
    $c = $b.GetPixel($x, $y)
    if ($c.A -gt 200 -and $c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$cx = $b.Width / 2.0; $cy = $b.Height / 2.0
$maxR = 0
foreach ($pt in @(@($minX, $minY), @($maxX, $minY), @($minX, $maxY), @($maxX, $maxY))) {
  $r = [Math]::Sqrt([Math]::Pow($pt[0] - $cx, 2) + [Math]::Pow($pt[1] - $cy, 2))
  if ($r -gt $maxR) { $maxR = $r }
}
""
"icon glyph corner radius {0:N0} vs inscribed {1:N0} -> {2}" -f $maxR, ($b.Width / 2.0), $(if ($maxR -lt $b.Width / 2.0) { 'safe on round masks' } else { 'MAY CLIP' })
$b.Dispose()
