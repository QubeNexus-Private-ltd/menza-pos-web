# Generate authentic sample JPEG and PDF invoices with Hindi and English text
Add-Type -AssemblyName System.Drawing

$outDir = "F:\menza-pos-web\public\dummy-invoices"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

function Create-SabziMandiJpeg {
    param([string]$path)

    $width = 750
    $height = 1050
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Paper background
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(254, 252, 243))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Outer border (dashed feel)
    $penDashed = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 160, 140)), 2
    $penDashed.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawRectangle($penDashed, 20, 20, $width - 40, $height - 40)

    # Fonts
    $fontHeading = [System.Drawing.Font]::new("Nirmala UI", [float]18, [System.Drawing.FontStyle]::Bold)
    $fontSub = [System.Drawing.Font]::new("Nirmala UI", [float]11, [System.Drawing.FontStyle]::Regular)
    $fontMeta = [System.Drawing.Font]::new("Nirmala UI", [float]11, [System.Drawing.FontStyle]::Bold)
    $fontTableHead = [System.Drawing.Font]::new("Nirmala UI", [float]12, [System.Drawing.FontStyle]::Bold)
    $fontRow = [System.Drawing.Font]::new("Nirmala UI", [float]11, [System.Drawing.FontStyle]::Regular)
    $fontTotal = [System.Drawing.Font]::new("Nirmala UI", [float]14, [System.Drawing.FontStyle]::Bold)

    $brushRed = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 20, 20))
    $brushDark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 30, 30))
    $brushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 90, 90))
    $brushBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 70, 160))

    $y = 45
    # Header
    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString("।। श्री गणेशाय नमः ।।", $fontSub, $brushRed, ($width / 2), $y, $sfCenter)
    $y += 28
    $g.DrawString("किसान सब्जी भण्डार", $fontHeading, $brushRed, ($width / 2), $y, $sfCenter)
    $y += 34
    $g.DrawString("KISAN SABZI BHANDAR (आजादपुर मंडी, दिल्ली)", $fontMeta, $brushDark, ($width / 2), $y, $sfCenter)
    $y += 24
    $g.DrawString("थोक व होटल सप्लायर | फोन: 98112-XXXXX, 98731-XXXXX", $fontSub, $brushGray, ($width / 2), $y, $sfCenter)
    $y += 35

    # Dividing Line
    $penLine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 60, 60)), 1.5
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 15

    # Meta
    $g.DrawString("पर्चा सं. / Slip No: KSB-842", $fontMeta, $brushDark, 50, $y)
    $g.DrawString("तारीख / Date: 14-Nov-2026", $fontMeta, $brushDark, 480, $y)
    $y += 26
    $g.DrawString("ग्राहक / Rest: Menza Cafe & Restaurant", $fontMeta, $brushDark, 50, $y)
    $g.DrawString("समय / Time: 06:45 AM (Morning Batch)", $fontSub, $brushGray, 480, $y)
    $y += 35

    # Table Header
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 8
    $g.DrawString("सामान विवरण (Item Name)", $fontTableHead, $brushDark, 50, $y)
    $g.DrawString("मात्रा (Qty)", $fontTableHead, $brushDark, 380, $y)
    $g.DrawString("भाव (Rate)", $fontTableHead, $brushDark, 510, $y)
    $g.DrawString("रकम (₹)", $fontTableHead, $brushDark, 630, $y)
    $y += 26
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 12

    # Items
    $items = @(
        @{ Name = "टमाटर (Desi Tomato)"; Qty = "25 Kg"; Rate = "38.00"; Amount = "950.00" },
        @{ Name = "प्याज (Nashik Onion)"; Qty = "40 Kg"; Rate = "32.00"; Amount = "1,280.00" },
        @{ Name = "आलू (Pahadi Potato)"; Qty = "50 Kg"; Rate = "24.00"; Amount = "1,200.00" },
        @{ Name = "अदरक (Fresh Ginger)"; Qty = "4 Kg"; Rate = "160.00"; Amount = "640.00" },
        @{ Name = "हरी मिर्च (Green Chilli)"; Qty = "2.5 Kg"; Rate = "80.00"; Amount = "200.00" },
        @{ Name = "हरा धनिया (Coriander)"; Qty = "5 Kg"; Rate = "60.00"; Amount = "300.00" },
        @{ Name = "लहसुन (Desi Garlic)"; Qty = "3 Kg"; Rate = "220.00"; Amount = "660.00" }
    )

    foreach ($it in $items) {
        $g.DrawString($it.Name, $fontRow, $brushDark, 50, $y)
        $g.DrawString($it.Qty, $fontRow, $brushDark, 390, $y)
        $g.DrawString($it.Rate, $fontRow, $brushDark, 520, $y)
        $g.DrawString($it.Amount, $fontRow, $brushDark, 630, $y)
        $y += 32
    }

    # Total Box
    $y += 10
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 10
    $g.DrawString("कुल योग / TOTAL AMOUNT:", $fontTotal, $brushDark, 50, $y)
    $g.DrawString("₹ 5,230.00", $fontTotal, $brushRed, 600, $y)
    $y += 35
    $g.DrawLine($penLine, 40, $y, $width - 40, $y)
    $y += 40

    # Stamp
    $stampPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(20, 70, 160)), 2
    $g.DrawRectangle($stampPen, 480, $y, 200, 50)
    $g.DrawString("PAID / RECEIVED", $fontMeta, $brushBlue, 505, $y + 14)
    $y += 80

    # Footer
    $g.DrawString("माल की तौल अपनी मौजूदगी में कराएं। धन्यवाद!", $fontSub, $brushGray, ($width / 2), $y, $sfCenter)

    # Save
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created JPEG: $path"
}

function Create-DairyBilingualJpeg {
    param([string]$path)

    $width = 800
    $height = 1100
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Crisp white background
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Blue header bar
    $bannerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 55, 110))
    $g.FillRectangle($bannerBrush, 25, 25, $width - 50, 95)

    $fontBanner = [System.Drawing.Font]::new("Arial", [float]16, [System.Drawing.FontStyle]::Bold)
    $fontBannerHi = [System.Drawing.Font]::new("Nirmala UI", [float]12, [System.Drawing.FontStyle]::Regular)
    $fontSmall = [System.Drawing.Font]::new("Arial", [float]9, [System.Drawing.FontStyle]::Regular)
    $fontMeta = [System.Drawing.Font]::new("Arial", [float]10, [System.Drawing.FontStyle]::Bold)
    $fontTableHead = [System.Drawing.Font]::new("Arial", [float]10, [System.Drawing.FontStyle]::Bold)
    $fontRow = [System.Drawing.Font]::new("Nirmala UI", [float]10.5, [System.Drawing.FontStyle]::Regular)
    $fontTotal = [System.Drawing.Font]::new("Arial", [float]13, [System.Drawing.FontStyle]::Bold)

    $brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $brushDark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 35, 35))
    $brushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 100, 100))
    $brushBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 55, 110))

    $g.DrawString("SHREE GANESH DAIRY & PROVISIONS", $fontBanner, $brushWhite, 45, 40)
    $g.DrawString("श्री गणेश डेयरी एवं प्रोविजन्स | FSSAI: 13320010000XXX", $fontBannerHi, $brushWhite, 45, 68)
    $g.DrawString("GSTIN: 07AABCU9603R1ZN | Phone: 98104-XXXXX | Delhi - 110001", $fontSmall, $brushWhite, 45, 92)

    $y = 140
    # Customer and Invoice Meta
    $g.DrawString("Billed To (प्रतिष्ठान):", $fontMeta, $brushBlue, 45, $y)
    $g.DrawString("Invoice Details:", $fontMeta, $brushBlue, 480, $y)
    $y += 20
    $g.DrawString("Menza Gourmet Kitchen (RestId 51)", $fontRow, $brushDark, 45, $y)
    $g.DrawString("Invoice No: SGD-4092", $fontRow, $brushDark, 480, $y)
    $y += 20
    $g.DrawString("Connaught Place, New Delhi", $fontRow, $brushDark, 45, $y)
    $g.DrawString("Date (दिनांक): 14/11/2026", $fontRow, $brushDark, 480, $y)
    $y += 20
    $g.DrawString("Attn: Head Chef / Kitchen Store", $fontSmall, $brushGray, 45, $y)
    $g.DrawString("Payment: 7 Days Credit", $fontSmall, $brushGray, 480, $y)
    $y += 35

    # Table Header Box
    $penGrid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(210, 210, 210)), 1
    $headBoxBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 246, 252))
    $g.FillRectangle($headBoxBrush, 40, $y, $width - 80, 32)
    $g.DrawRectangle($penGrid, 40, $y, $width - 80, 32)

    $g.DrawString("Item Description / सामग्री", $fontTableHead, $brushDark, 55, $y + 8)
    $g.DrawString("Qty", $fontTableHead, $brushDark, 430, $y + 8)
    $g.DrawString("Unit", $fontTableHead, $brushDark, 500, $y + 8)
    $g.DrawString("Rate (₹)", $fontTableHead, $brushDark, 570, $y + 8)
    $g.DrawString("Total (₹)", $fontTableHead, $brushDark, 675, $y + 8)
    $y += 32

    # Items
    $items = @(
        @{ Desc = "Fresh Malai Paneer (मलाई पनीर)"; Qty = "12.0"; Unit = "Kg"; Rate = "320.00"; Total = "3,840.00" },
        @{ Desc = "Amul Table Butter 500g (मक्खन)"; Qty = "10.0"; Unit = "Pcs"; Rate = "275.00"; Total = "2,750.00" },
        @{ Desc = "Fresh Cow Milk (गाय का ताजा दूध)"; Qty = "30.0"; Unit = "Ltr"; Rate = "62.00"; Total = "1,860.00" },
        @{ Desc = "Cooking Heavy Cream 1L (क्रीम)"; Qty = "6.0"; Unit = "Pcs"; Rate = "190.00"; Total = "1,140.00" },
        @{ Desc = "Thick Curd / Dahi (गाढ़ा दही)"; Qty = "15.0"; Unit = "Kg"; Rate = "75.00"; Total = "1,125.00" }
    )

    foreach ($it in $items) {
        $g.DrawRectangle($penGrid, 40, $y, $width - 80, 42)
        $g.DrawString($it.Desc, $fontRow, $brushDark, 55, $y + 11)
        $g.DrawString($it.Qty, $fontRow, $brushDark, 435, $y + 11)
        $g.DrawString($it.Unit, $fontRow, $brushDark, 505, $y + 11)
        $g.DrawString($it.Rate, $fontRow, $brushDark, 575, $y + 11)
        $g.DrawString($it.Total, $fontRow, $brushDark, 680, $y + 11)
        $y += 42
    }

    # Total Box
    $totBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 242, 250))
    $g.FillRectangle($totBrush, 40, $y, $width - 80, 45)
    $g.DrawRectangle($penGrid, 40, $y, $width - 80, 45)

    $g.DrawString("Grand Total / कुल देय राशि:", $fontTotal, $brushBlue, 55, $y + 12)
    $g.DrawString("₹ 10,715.00", $fontTotal, $brushBlue, 660, $y + 12)
    $y += 65

    # Price hike alert indicator
    $alertBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(254, 242, 242))
    $alertPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(248, 113, 113)), 1
    $g.FillRectangle($alertBrush, 40, $y, $width - 80, 40)
    $g.DrawRectangle($alertPen, 40, $y, $width - 80, 40)
    $brushRed = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(185, 28, 28))
    $g.DrawString("⚠️ Price Alert: Malai Paneer rate increased +10.3% (was ₹290 on previous bill)", $fontSmall, $brushRed, 55, $y + 12)
    $y += 70

    # Signatures
    $penDash = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 180, 180)), 1
    $penDash.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawLine($penDash, 50, $y + 30, 250, $y + 30)
    $g.DrawLine($penDash, 520, $y + 30, 720, $y + 30)
    $g.DrawString("Supplier Signature", $fontSmall, $brushGray, 90, $y + 35)
    $g.DrawString("Receiver Signature (Menza)", $fontSmall, $brushGray, 540, $y + 35)

    # Save
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created JPEG: $path"
}

Create-SabziMandiJpeg "$outDir\sabzi_mandi_hindi_invoice.jpg"
Create-DairyBilingualJpeg "$outDir\dairy_bilingual_invoice.jpg"
