Add-Type -AssemblyName System.Drawing

function Generate-MasterIcon {
    $size = 512
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Transparent Background (clean PNG alpha channel)
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Perfectly Centered Coordinates on 512x512 canvas:
    # Folder dimensions:
    # Width = 374px (from x=69 to x=443) -> exactly centered (margin 69px each side)
    # Height = 250px (from y=115 to y=365)
    # Tab on top: from x=69 to x=210, y=78 to y=115
    
    $fx = 69
    $fy = 115
    $fw = 374
    $fh = 250
    $tabW = 145
    $tabH = 37
    $cornerR = 26
    
    # Folder Path
    $folderPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    
    # Start at top-left of tab (rounded)
    $folderPath.AddArc($fx, $fy - $tabH, $cornerR, $cornerR, 180, 90)
    # Flat top of tab
    $folderPath.AddLine($fx + $cornerR/2, $fy - $tabH, $fx + $tabW - 20, $fy - $tabH)
    # Slope down to folder body top
    $folderPath.AddBezier($fx + $tabW - 20, $fy - $tabH, $fx + $tabW, $fy - $tabH, $fx + $tabW + 10, $fy, $fx + $tabW + 30, $fy)
    # Flat top to right corner
    $folderPath.AddLine($fx + $tabW + 30, $fy, $fx + $fw - $cornerR, $fy)
    # Top-right corner
    $folderPath.AddArc($fx + $fw - $cornerR, $fy, $cornerR, $cornerR, 270, 90)
    # Right edge
    $folderPath.AddLine($fx + $fw, $fy + $cornerR, $fx + $fw, $fy + $fh - $cornerR)
    # Bottom-right corner
    $folderPath.AddArc($fx + $fw - $cornerR, $fy + $fh - $cornerR, $cornerR, $cornerR, 0, 90)
    # Bottom edge
    $folderPath.AddLine($fx + $fw - $cornerR, $fy + $fh, $fx + $cornerR, $fy + $fh)
    # Bottom-left corner
    $folderPath.AddArc($fx, $fy + $fh - $cornerR, $cornerR, $cornerR, 90, 90)
    # Left edge up to tab
    $folderPath.AddLine($fx, $fy + $fh - $cornerR, $fx, $fy - $tabH + $cornerR/2)
    $folderPath.CloseFigure()
    
    # Fill Folder: Vibrant Modern Blue (#2563eb)
    $blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
    $g.FillPath($blueBrush, $folderPath)
    
    # Bookmark Ribbon:
    # Width = 74px
    # Position: around 75% mark of folder width.
    # Folder is from x=69 to x=443 (width 374).
    # 75% mark of width is 69 + 374 * 0.75 = 349.5.
    # Center ribbon around x=349.5 -> ribbon from x=312 to x=386.
    # Folder ends at 443, so 443 - 386 = 57px of blue folder peeking out on the right!
    # Top: y = 90 (starts slightly above the main folder body y=115)
    # Bottom: y = 434 (hangs below the folder bottom y=365)
    # Notch: y = 388 (inverted V tail)
    
    $rx = 312
    $rw = 74
    $ryTop = 90
    $ryBottom = 434
    $ryNotch = 388
    
    $ribbonPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ribbonPath.AddLine($rx, $ryTop, $rx + $rw, $ryTop)
    $ribbonPath.AddLine($rx + $rw, $ryTop, $rx + $rw, $ryBottom)
    $ribbonPath.AddLine($rx + $rw, $ryBottom, $rx + $rw/2, $ryNotch)
    $ribbonPath.AddLine($rx + $rw/2, $ryNotch, $rx, $ryBottom)
    $ribbonPath.AddLine($rx, $ryBottom, $rx, $ryTop)
    $ribbonPath.CloseFigure()
    
    # Fill Ribbon: Vibrant Red (#dc2626)
    $redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 220, 38, 38))
    $g.FillPath($redBrush, $ribbonPath)
    
    $g.Dispose()
    return $bmp
}

$master = Generate-MasterIcon
$sizes = @(16, 32, 48, 128)

foreach ($s in $sizes) {
    $targetBmp = New-Object System.Drawing.Bitmap($s, $s)
    $tg = [System.Drawing.Graphics]::FromImage($targetBmp)
    $tg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $tg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $tg.Clear([System.Drawing.Color]::Transparent)
    $tg.DrawImage($master, 0, 0, $s, $s)
    $tg.Dispose()
    
    $dest = "C:\Data\Vibe-Coding\TabMax\icons\icon-$s.png"
    $targetBmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $targetBmp.Dispose()
    Write-Host "Generated $dest"
}

# Also save preview
$master.Save("C:\Data\Vibe-Coding\TabMax\icons\icon-preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
$master.Dispose()
