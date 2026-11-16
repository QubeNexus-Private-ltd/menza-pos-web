Add-Type -AssemblyName System.Drawing

function Create-HandwrittenParcha {
    param (
        [string]$OutputPath,
        [int]$Width = 850,
        [int]$Height = 1150
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 1. Notebook paper background (slightly aged yellowish-white paper)
    $paperBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 252, 245))
    $g.FillRectangle($paperBrush, 0, 0, $Width, $Height)

    # 2. Draw ruled notebook lines (faint cyan/blue lines)
    $rulePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210, 230, 245), 1.2)
    for ($y = 120; $y -lt $Height - 60; $y += 38) {
        $g.DrawLine($rulePen, 30, $y, $Width - 30, $y)
    }

    # 3. Draw vertical red margin line
    $marginPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(240, 160, 160), 1.5)
    $g.DrawLine($marginPen, 110, 40, 110, $Height - 40)
    $g.DrawLine($marginPen, 115, 40, 115, $Height - 40)

    # 4. Ballpoint pen colors
    $penBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 50, 115))
    $penDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 30, 75))
    $redInk = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 30, 30))

    $scriptFontFamily = "Segoe Script"
    $hindiFontFamily = "Nirmala UI"

    # Define all fonts beforehand
    $shreeFont = New-Object System.Drawing.Font($hindiFontFamily, 13, [System.Drawing.FontStyle]::Bold)
    $shopFontHindi = New-Object System.Drawing.Font($hindiFontFamily, 22, [System.Drawing.FontStyle]::Bold)
    $shopFontEng = New-Object System.Drawing.Font($scriptFontFamily, 15, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font($hindiFontFamily, 11, [System.Drawing.FontStyle]::Regular)
    $metaFont = New-Object System.Drawing.Font($scriptFontFamily, 13, [System.Drawing.FontStyle]::Bold)
    $handwritingFont = New-Object System.Drawing.Font($scriptFontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $thFont = New-Object System.Drawing.Font($hindiFontFamily, 12, [System.Drawing.FontStyle]::Bold)
    $itemHindiFont = New-Object System.Drawing.Font($hindiFontFamily, 13, [System.Drawing.FontStyle]::Bold)
    $amountFont = New-Object System.Drawing.Font($scriptFontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $totalLabelFont = New-Object System.Drawing.Font($hindiFontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $grandTotalFont = New-Object System.Drawing.Font($scriptFontFamily, 20, [System.Drawing.FontStyle]::Bold)
    $wordsFont = New-Object System.Drawing.Font($scriptFontFamily, 12, [System.Drawing.FontStyle]::Bold)
    $footFont = New-Object System.Drawing.Font($hindiFontFamily, 11, [System.Drawing.FontStyle]::Regular)
    $signFont = New-Object System.Drawing.Font($scriptFontFamily, 16, [System.Drawing.FontStyle]::Bold)

    # Top Religious invocation
    $g.DrawString("॥ श्री गणेशाय नमः ॥", $shreeFont, $redInk, [float]330, [float]25)

    # Shop Name in Hindi & English
    $g.DrawString("श्री श्याम कृपा सब्जी भण्डार", $shopFontHindi, $penDark, [float]240, [float]52)
    $g.DrawString("Shree Shyam Kripa Sabzi Mandi", $shopFontEng, $penBlue, [float]255, [float]90)
    $g.DrawString("दुकान नं. 48, कृषि उपज मंडी, भोपाल | मो. 98261-44321", $subFont, $penBlue, [float]235, [float]122)

    # Bill metadata
    $g.DrawString("No: 108", $metaFont, $redInk, [float]40, [float]158)
    $g.DrawString("Date: 15-11-2026", $metaFont, $penBlue, [float]620, [float]158)
    $g.DrawString("M/s: Menza Cafe & Restro (Main Kitchen)", $handwritingFont, $penDark, [float]130, [float]196)

    # Table Header Line
    $headerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 70, 140), 2)
    $g.DrawLine($headerPen, 40, 240, $Width - 40, 240)
    $g.DrawLine($headerPen, 40, 275, $Width - 40, 275)

    $g.DrawString("क्र.", $thFont, $penDark, [float]55, [float]248)
    $g.DrawString("विवरण / Item Name", $thFont, $penDark, [float]140, [float]248)
    $g.DrawString("वजन (Qty)", $thFont, $penDark, [float]430, [float]248)
    $g.DrawString("भाव (Rate)", $thFont, $penDark, [float]560, [float]248)
    $g.DrawString("रकम (Amount)", $thFont, $penDark, [float]685, [float]248)

    # Handwritten Items List
    $items = @(
        @{ No="1"; Hi="आलू (Desi Potato)"; Qty="50 Kg"; Rate="22"; Total="1100" },
        @{ No="2"; Hi="प्याज (Nashik Onion)"; Qty="40 Kg"; Rate="32"; Total="1280" },
        @{ No="3"; Hi="टमाटर (Fresh Tomato)"; Qty="25 Kg"; Rate="36"; Total="900" },
        @{ No="4"; Hi="अदरक (Ginger)"; Qty="4 Kg"; Rate="140"; Total="560" },
        @{ No="5"; Hi="हरी मिर्च (Green Chilli)"; Qty="3 Kg"; Rate="75"; Total="225" },
        @{ No="6"; Hi="हरा धनिया (Coriander)"; Qty="5 Kg"; Rate="40"; Total="200" },
        @{ No="7"; Hi="लहसुन (Desi Garlic)"; Qty="3.5 Kg"; Rate="220"; Total="770" },
        @{ No="8"; Hi="गोभी (Cauliflower)"; Qty="15 Pcs"; Rate="25"; Total="375" },
        @{ No="9"; Hi="नींबू (Fresh Lemon)"; Qty="2 Kg"; Rate="80"; Total="160" }
    )

    $rowY = 285
    $rowHeight = 44

    foreach ($it in $items) {
        $g.DrawString($it.No, $handwritingFont, $penBlue, [float]65, [float]($rowY + 4))
        $g.DrawString($it.Hi, $itemHindiFont, $penDark, [float]135, [float]($rowY + 2))
        $g.DrawString($it.Qty, $amountFont, $penBlue, [float]440, [float]($rowY + 3))
        $g.DrawString(("Rs " + $it.Rate), $amountFont, $penBlue, [float]570, [float]($rowY + 3))
        $g.DrawString(("Rs " + $it.Total), $amountFont, $penDark, [float]695, [float]($rowY + 3))
        $rowY += $rowHeight
    }

    # Total divider lines
    $g.DrawLine($headerPen, 400, $rowY + 15, $Width - 40, $rowY + 15)
    $g.DrawLine($headerPen, 400, $rowY + 60, $Width - 40, $rowY + 60)

    $g.DrawString("कुल योग / TOTAL:", $totalLabelFont, $penDark, [float]440, [float]($rowY + 25))
    $g.DrawString("Rs 5,570.00", $grandTotalFont, $redInk, [float]660, [float]($rowY + 20))
    $g.DrawString("In Words: Five Thousand Five Hundred Seventy Only", $wordsFont, $penBlue, [float]130, [float]($rowY + 75))

    $g.DrawString("माल चेक करके लिया जावे। बाद में शिकायत मान्य नहीं होगी।", $footFont, [System.Drawing.Brushes]::Gray, [float]130, [float]($Height - 160))
    $g.DrawString("भुगतान: उधार (Due / Pay on delivery)", $footFont, $redInk, [float]130, [float]($Height - 130))

    $g.DrawString("Shyam Kripa", $signFont, $penDark, [float]630, [float]($Height - 150))
    $g.DrawString("हस्ताक्षर / Signature", $footFont, [System.Drawing.Brushes]::DimGray, [float]630, [float]($Height - 110))

    $stampPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 180, 40, 40), 2)
    $g.DrawEllipse($stampPen, 610, ($Height - 180), 160, 90)

    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created Handwritten Mandi Parcha: $OutputPath"
}

function Create-HandwrittenDairySlip {
    param (
        [string]$OutputPath,
        [int]$Width = 850,
        [int]$Height = 1100
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $paperBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 253, 238))
    $g.FillRectangle($paperBrush, 0, 0, $Width, $Height)

    $rulePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 235, 245), 1.2)
    for ($y = 100; $y -lt $Height - 50; $y += 36) {
        $g.DrawLine($rulePen, 25, $y, $Width - 25, $y)
    }

    $marginPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 175, 175), 1.5)
    $g.DrawLine($marginPen, 105, 30, 105, $Height - 30)

    $penBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 45, 120))
    $penDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 25, 60))
    $redInk = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190, 25, 25))

    $scriptFontFamily = "Segoe Script"
    $hindiFontFamily = "Nirmala UI"

    $omFont = New-Object System.Drawing.Font($hindiFontFamily, 12, [System.Drawing.FontStyle]::Bold)
    $shopFontHindi = New-Object System.Drawing.Font($hindiFontFamily, 22, [System.Drawing.FontStyle]::Bold)
    $shopFontEng = New-Object System.Drawing.Font($scriptFontFamily, 15, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font($hindiFontFamily, 11)
    $handFont = New-Object System.Drawing.Font($scriptFontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $itemFont = New-Object System.Drawing.Font($hindiFontFamily, 13, [System.Drawing.FontStyle]::Bold)
    $thFont = New-Object System.Drawing.Font($hindiFontFamily, 12, [System.Drawing.FontStyle]::Bold)
    $totalHeadFont = New-Object System.Drawing.Font($hindiFontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $totalNumFont = New-Object System.Drawing.Font($scriptFontFamily, 20, [System.Drawing.FontStyle]::Bold)
    $wordsFont = New-Object System.Drawing.Font($scriptFontFamily, 12, [System.Drawing.FontStyle]::Bold)
    $paidFont = New-Object System.Drawing.Font($scriptFontFamily, 16, [System.Drawing.FontStyle]::Bold)
    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 130, 60))
    $recFont = New-Object System.Drawing.Font($hindiFontFamily, 11)

    $g.DrawString("॥ ॐ नमः शिवाय ॥", $omFont, $redInk, [float]350, [float]20)
    $g.DrawString("राधे कृष्ण डेयरी फार्म", $shopFontHindi, $penDark, [float]280, [float]48)
    $g.DrawString("Radhe Krishna Dairy & Paneer Center", $shopFontEng, $penBlue, [float]220, [float]86)
    $g.DrawString("दूध, दही, पनीर, मक्खन, खोया के थोक विक्रेता | फोन: 94250-88112", $subFont, $penBlue, [float]210, [float]118)

    $g.DrawString("Slip: RK-412", $handFont, $redInk, [float]35, [float]148)
    $g.DrawString("Date: 15/11/2026", $handFont, $penBlue, [float]630, [float]148)
    $g.DrawString("Customer: Menza Restro (Chef Rajeev)", $handFont, $penDark, [float]125, [float]184)

    $hPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 60, 130), 2)
    $g.DrawLine($hPen, 35, 225, $Width - 35, 225)
    $g.DrawLine($hPen, 35, 260, $Width - 35, 260)

    $g.DrawString("S.No", $thFont, $penDark, [float]45, [float]232)
    $g.DrawString("Item Particulars", $thFont, $penDark, [float]135, [float]232)
    $g.DrawString("Qty (वजन)", $thFont, $penDark, [float]430, [float]232)
    $g.DrawString("Rate (भाव)", $thFont, $penDark, [float]570, [float]232)
    $g.DrawString("Total (रुपये)", $thFont, $penDark, [float]690, [float]232)

    $dairyItems = @(
        @{ No="1"; Name="Fresh Paneer (मलाई पनीर)"; Qty="15 Kg"; Rate="320"; Total="4800" },
        @{ No="2"; Name="Cow Milk (गाय का ताजा दूध)"; Qty="40 Ltr"; Rate="62"; Total="2480" },
        @{ No="3"; Name="Fresh Dahi (गाढ़ा दही)"; Qty="20 Kg"; Rate="75"; Total="1500" },
        @{ No="4"; Name="Khoya / Mawa (मावा)"; Qty="5 Kg"; Rate="380"; Total="1900" },
        @{ No="5"; Name="White Butter (मक्खन)"; Qty="4 Kg"; Rate="420"; Total="1680" },
        @{ No="6"; Name="Cooking Cream (क्रीम 1L)"; Qty="6 Pcs"; Rate="190"; Total="1140" }
    )

    $rowY = 270
    $rowHeight = 44

    foreach ($it in $dairyItems) {
        $g.DrawString($it.No, $handFont, $penBlue, [float]55, [float]($rowY + 4))
        $g.DrawString($it.Name, $itemFont, $penDark, [float]130, [float]($rowY + 2))
        $g.DrawString($it.Qty, $handFont, $penBlue, [float]435, [float]($rowY + 3))
        $g.DrawString(("Rs " + $it.Rate), $handFont, $penBlue, [float]575, [float]($rowY + 3))
        $g.DrawString(("Rs " + $it.Total), $handFont, $penDark, [float]695, [float]($rowY + 3))
        $rowY += $rowHeight
    }

    $g.DrawLine($hPen, 390, $rowY + 15, $Width - 35, $rowY + 15)
    $g.DrawLine($hPen, 390, $rowY + 60, $Width - 35, $rowY + 60)

    $g.DrawString("TOTAL AMOUNT:", $totalHeadFont, $penDark, [float]430, [float]($rowY + 25))
    $g.DrawString("Rs 13,500.00", $totalNumFont, $redInk, [float]640, [float]($rowY + 20))
    $g.DrawString("Thirteen Thousand Five Hundred Rupees Only", $wordsFont, $penBlue, [float]130, [float]($rowY + 75))

    $g.DrawString("PAID via PhonePe UPI", $paidFont, $greenBrush, [float]130, [float]($Height - 140))
    $g.DrawString("Radhe Krishna Dairy", $paidFont, $penDark, [float]610, [float]($Height - 150))
    $g.DrawString("Receiver Signature", $recFont, [System.Drawing.Brushes]::DimGray, [float]620, [float]($Height - 110))

    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created Handwritten Dairy Slip: $OutputPath"
}

$dir = "F:\menza-pos-web\public\dummy-invoices"
Create-HandwrittenParcha "$dir\handwritten_mandi_parcha.jpg" 850 1150
Create-HandwrittenDairySlip "$dir\handwritten_dairy_slip.jpg" 850 1100
