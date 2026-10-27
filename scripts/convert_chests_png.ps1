Add-Type -AssemblyName System.Drawing

function Convert-ToTransparentPng($srcPath, $destPath, $threshold, $feather) {
    $src = [System.Drawing.Bitmap]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    $rect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
    $srcData = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $destData = $dest.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    $bytes = [Math]::Abs($srcData.Stride) * $src.Height
    $rgbValues = New-Object byte[] $bytes
    [System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $rgbValues, 0, $bytes)
    
    for ($i = 0; $i -lt $bytes; $i += 4) {
        $b = [int]$rgbValues[$i]
        $g = [int]$rgbValues[$i + 1]
        $r = [int]$rgbValues[$i + 2]
        $max = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($max -le $threshold) {
            $rgbValues[$i + 3] = 0
        } elseif ($max -lt ($threshold + $feather)) {
            $alpha = [int](255 * ($max - $threshold) / $feather)
            $rgbValues[$i + 3] = [byte]$alpha
        } else {
            $rgbValues[$i + 3] = 255
        }
    }
    
    [System.Runtime.InteropServices.Marshal]::Copy($rgbValues, 0, $destData.Scan0, $bytes)
    $src.UnlockBits($srcData)
    $dest.UnlockBits($destData)
    $src.Dispose()
    
    $dest.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Output "Saved transparent PNG: $destPath"
}

Convert-ToTransparentPng 'public/images/chests/chest_wooden.jpg' 'public/images/chests/chest_wooden.png' 26 22
Convert-ToTransparentPng 'public/images/chests/chest_silver.jpg' 'public/images/chests/chest_silver.png' 26 22
Convert-ToTransparentPng 'public/images/chests/chest_gold.jpg' 'public/images/chests/chest_gold.png' 26 22
