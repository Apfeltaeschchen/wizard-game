param(
    [string]$SourceIcon = "public/images/icon.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceIcon)) {
    Write-Error "Source icon not found at: $SourceIcon"
    exit 1
}

$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $SourceIcon).Path)

function Resize-And-Save($src, $targetPath, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($src, 0, 0, $width, $height)
    $graphics.Dispose()

    $parentDir = Split-Path -Parent $targetPath
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $targetPath ($($width)x$($height))"
}

$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48; FgSize = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; FgSize = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; FgSize = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; FgSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; FgSize = 432 }
)

$resDir = "android/app/src/main/res"

foreach ($d in $densities) {
    $folder = Join-Path $resDir $d.Name
    
    # 1. Standard Launcher Icon
    $launcherPath = Join-Path $folder "ic_launcher.png"
    Resize-And-Save $sourceImg $launcherPath $d.Size $d.Size

    # 2. Round Launcher Icon
    $roundPath = Join-Path $folder "ic_launcher_round.png"
    Resize-And-Save $sourceImg $roundPath $d.Size $d.Size

    # 3. Foreground Icon
    $fgPath = Join-Path $folder "ic_launcher_foreground.png"
    Resize-And-Save $sourceImg $fgPath $d.FgSize $d.FgSize
}

$sourceImg.Dispose()
Write-Host "All Android icons generated successfully!"
