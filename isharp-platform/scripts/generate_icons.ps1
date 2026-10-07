Add-Type -AssemblyName System.Drawing

function Generate-PwaIcon([int]$size, [string]$outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient: Frutiger Aero Sky / Cyan
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $cTop = [System.Drawing.ColorTranslator]::FromHtml('#f0f9ff')
    $cBottom = [System.Drawing.ColorTranslator]::FromHtml('#0284c7')
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)
    $g.FillRectangle($brush, $rect)

    # Load Blue Archipelago logo
    $logoPath = Resolve-Path 'public\assets\blue-archipelago-logo.png'
    $logo = [System.Drawing.Image]::FromFile($logoPath)

    # Center the logo with padding
    $pad = [int]($size * 0.12)
    $targetWidth = $size - ($pad * 2)
    $ratio = $targetWidth / $logo.Width
    $targetHeight = [int]($logo.Height * $ratio)
    $destY = [int](($size - $targetHeight) / 2)

    $destRect = New-Object System.Drawing.Rectangle($pad, $destY, $targetWidth, $targetHeight)
    $g.DrawImage($logo, $destRect)

    $outFull = [System.IO.Path]::GetFullPath($outputPath)
    $bmp.Save($outFull, [System.Drawing.Imaging.ImageFormat]::Png)
    $logo.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $outFull"
}

Generate-PwaIcon 192 'public\assets\icon-192.png'
Generate-PwaIcon 512 'public\assets\icon-512.png'
