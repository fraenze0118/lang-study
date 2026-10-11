# setup-local-build.ps1 - configure local Android build environment
# Run in YOUR OWN terminal (not the sandbox):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-local-build.ps1

$ErrorActionPreference = 'Stop'

$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path $sdk)) {
  Write-Host "[X] Android SDK not found: $sdk" -ForegroundColor Red
  exit 1
}

[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdk, 'User')
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Host "[OK] ANDROID_HOME = $sdk" -ForegroundColor Green

$roots = @('C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java', 'C:\Program Files\Microsoft')
$javaHome = $null

foreach ($r in $roots) {
  if (Test-Path $r) {
    $j = Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'jdk-17*' } | Select-Object -First 1
    if ($j) { $javaHome = $j.FullName; break }
  }
}

if (-not $javaHome) {
  foreach ($r in $roots) {
    if (Test-Path $r) {
      $j = Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'jdk-2*' } | Select-Object -First 1
      if ($j) {
        $javaHome = $j.FullName
        Write-Host "[!] JDK 17 not found, using $($j.Name) (RN needs JDK 17; install it if build fails)" -ForegroundColor Yellow
        break
      }
    }
  }
}

if ($javaHome) {
  [Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')
  $env:JAVA_HOME = $javaHome
  Write-Host "[OK] JAVA_HOME = $javaHome" -ForegroundColor Green
} else {
  Write-Host "[X] JDK not found. Install Temurin 17:" -ForegroundColor Red
  Write-Host '    winget install EclipseAdoptium.Temurin.17.JDK'
  Write-Host '    or download MSI from https://adoptium.net'
}

Write-Host ''
Write-Host 'Next steps (open a NEW terminal window):' -ForegroundColor Cyan
Write-Host '  cd D:\study\frontend\lang-study\app'
Write-Host '  $env:EXPO_TOKEN = ''your-token'''
Write-Host '  npx eas build --local -p android --profile preview'
