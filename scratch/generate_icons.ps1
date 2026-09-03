Add-Type -AssemblyName System.Drawing

$sourcePath = "d:\Devs\GitHub\JLib-Sync\public\logo.jpg"
if (-not (Test-Path $sourcePath)) {
    $sourcePath = "d:\Devs\GitHub\JLib-Sync\logo.jpg"
}

Write-Host "Source image: $sourcePath"
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$DestinationPath
    )
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $destImage = New-Object System.Drawing.Bitmap($Width, $Height)
    $destImage.SetResolution($Image.HorizontalResolution, $Image.VerticalResolution)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $graphics.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()

    $destImage.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImage.Dispose()
    Write-Host "Created: $DestinationPath"
}

Resize-Image -Image $sourceImg -Width 192 -Height 192 -DestinationPath "d:\Devs\GitHub\JLib-Sync\public\pwa-192x192.png"
Resize-Image -Image $sourceImg -Width 512 -Height 512 -DestinationPath "d:\Devs\GitHub\JLib-Sync\public\pwa-512x512.png"
Resize-Image -Image $sourceImg -Width 180 -Height 180 -DestinationPath "d:\Devs\GitHub\JLib-Sync\public\apple-touch-icon.png"
Resize-Image -Image $sourceImg -Width 512 -Height 512 -DestinationPath "d:\Devs\GitHub\JLib-Sync\public\maskable-icon-512x512.png"

$sourceImg.Dispose()
Write-Host "All PWA icons generated successfully!"
