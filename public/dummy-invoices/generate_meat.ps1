# Helper to generate Poultry Meat JPEG & PDF
Add-Type -AssemblyName System.Drawing

$outDir = "F:\menza-pos-web\public\dummy-invoices"

function Create-MeatJpeg {
    param([string]$path)

    $width = 750
    $height = 1000
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Cream paper background
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 253, 245))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Border
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 150, 120)), 2
    $g.DrawRectangle($pen, 20, 20, $width - 40, $height - 40)

    $fontHead = [System.Drawing.Font]::new("Nirmala UI", [float]18, [System.Drawing.FontStyle]::Bold)
    $fontSub = [System.Drawing.Font]::new("Nirmala UI", [float]11, [System.Drawing.FontStyle]::Regular)
    $fontMeta = [System.Drawing.Font]::new("Nirmala UI", [float]11, [System.Drawing.FontStyle]::Bold)
    $fontTable = [System.Drawing.Font]::new("Nirmala UI", [float]11.5, [System.Drawing.FontStyle]::Regular)
    $fontTot = [System.Drawing.Font]::new("Nirmala UI", [float]14, [System.Drawing.FontStyle]::Bold)

    $brushRed = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 40, 40))
    $brushDark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(25, 25, 25))
    $brushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 100, 100))

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center

    $y = 45
    $g.DrawString("पंजाब चिकन & मटन कार्नर", $fontHead, $brushRed, ($width / 2), $y, $sf)
    $y += 32
    $g.DrawString("PUNJAB CHICKEN & MEAT CORNER (गाजीपुर मंडी, दिल्ली)", $fontMeta, $brushDark, ($width / 2), $y, $sf)
    $y += 24
    $g.DrawString("होटल व रेस्टोरेंट सप्लायर | फोन: 99580-XXXXX", $fontSub, $brushGray, ($width / 2), $y, $sf)
    $y += 35

    $penLine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 50, 50)), 1.5
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 15

    $g.DrawString("पर्चा नं. / Slip: PCM-502", $fontMeta, $brushDark, 50, $y)
    $g.DrawString("तारीख / Date: 14/11/2026", $fontMeta, $brushDark, 480, $y)
    $y += 25
    $g.DrawString("सप्लाई दी: Menza Cafe (Main Kitchen)", $fontMeta, $brushDark, 50, $y)
    $g.DrawString("शिफ्ट: 07:00 AM Delivery", $fontSub, $brushGray, 480, $y)
    $y += 35

    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 8
    $g.DrawString("आइटम (Item Name)", $fontMeta, $brushDark, 50, $y)
    $g.DrawString("वजन (Qty)", $fontMeta, $brushDark, 380, $y)
    $g.DrawString("रेट (Rate)", $fontMeta, $brushDark, 500, $y)
    $g.DrawString("रकम (Total)", $fontMeta, $brushDark, 620, $y)
    $y += 25
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 15

    $items = @(
        @{ Name = "बोनेलेस चिकन (Chicken Boneless)"; Qty = "15 Kg"; Rate = "260.00"; Amt = "3,900.00" },
        @{ Name = "करी कट चिकन (Curry Cut Chicken)"; Qty = "20 Kg"; Rate = "180.00"; Amt = "3,600.00" },
        @{ Name = "ताजा मटन (Fresh Mutton Curry Cut)"; Qty = "8 Kg"; Rate = "750.00"; Amt = "6,000.00" },
        @{ Name = "अंडा क्रेट (Egg Crates 30 Pcs)"; Qty = "5 Crate"; Rate = "195.00"; Amt = "975.00" }
    )

    foreach ($it in $items) {
        $g.DrawString($it.Name, $fontTable, $brushDark, 50, $y)
        $g.DrawString($it.Qty, $fontTable, $brushDark, 390, $y)
        $g.DrawString($it.Rate, $fontTable, $brushDark, 510, $y)
        $g.DrawString($it.Amt, $fontTable, $brushDark, 620, $y)
        $y += 36
    }

    $y += 15
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 12
    $g.DrawString("कुल रकम / TOTAL AMOUNT:", $fontTot, $brushDark, 50, $y)
    $g.DrawString("₹ 14,475.00", $fontTot, $brushRed, 590, $y)
    $y += 35
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 50

    $g.DrawString("माल तौल कर प्राप्त किया। शिकायत 2 घंटे में दर्ज कराएं।", $fontSub, $brushGray, ($width / 2), $y, $sf)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created Meat JPEG: $path"
}

Create-MeatJpeg "$outDir\poultry_meat_invoice.jpg"
