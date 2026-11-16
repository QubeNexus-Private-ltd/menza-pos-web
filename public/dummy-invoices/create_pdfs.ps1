# Helper to convert JPEG invoices into 100% valid PDF 1.4 documents
function Convert-JpegToPdf {
    param (
        [string]$JpegPath,
        [string]$PdfPath,
        [int]$ImageWidth = 800,
        [int]$ImageHeight = 1100
    )

    $jpegBytes = [System.IO.File]::ReadAllBytes($JpegPath)
    $streamLength = $jpegBytes.Length

    # Standard A4 size in points: 595.28 x 841.89
    $pageWidth = 595.28
    $pageHeight = 841.89

    $contentStream = "q `n$pageWidth 0 0 $pageHeight 0 0 cm `n/Im1 Do `nQ`n"
    $contentBytes = [System.Text.Encoding]::ASCII.GetBytes($contentStream)
    $contentLength = $contentBytes.Length

    $ms = New-Object System.IO.MemoryStream

    # 1. Header
    $header = [System.Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n%âãÏÓ`n")
    $ms.Write($header, 0, $header.Length)

    $offsets = New-Object System.Collections.Generic.List[long]

    # Obj 1: Catalog
    $offsets.Add($ms.Position)
    $obj1 = [System.Text.Encoding]::ASCII.GetBytes("1 0 obj`n<< /Type /Catalog /Pages 2 0 R >>`nendobj`n")
    $ms.Write($obj1, 0, $obj1.Length)

    # Obj 2: Pages
    $offsets.Add($ms.Position)
    $obj2 = [System.Text.Encoding]::ASCII.GetBytes("2 0 obj`n<< /Type /Pages /Kids [3 0 R] /Count 1 >>`nendobj`n")
    $ms.Write($obj2, 0, $obj2.Length)

    # Obj 3: Page
    $offsets.Add($ms.Position)
    $obj3 = [System.Text.Encoding]::ASCII.GetBytes("3 0 obj`n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $pageWidth $pageHeight] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`nendobj`n")
    $ms.Write($obj3, 0, $obj3.Length)

    # Obj 4: Content Stream
    $offsets.Add($ms.Position)
    $obj4Head = [System.Text.Encoding]::ASCII.GetBytes("4 0 obj`n<< /Length $contentLength >>`nstream`n")
    $ms.Write($obj4Head, 0, $obj4Head.Length)
    $ms.Write($contentBytes, 0, $contentBytes.Length)
    $obj4Foot = [System.Text.Encoding]::ASCII.GetBytes("`nendstream`nendobj`n")
    $ms.Write($obj4Foot, 0, $obj4Foot.Length)

    # Obj 5: Image XObject (JPEG /DCTDecode)
    $offsets.Add($ms.Position)
    $obj5Head = [System.Text.Encoding]::ASCII.GetBytes("5 0 obj`n<< /Type /XObject /Subtype /Image /Width $ImageWidth /Height $ImageHeight /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length $streamLength >>`nstream`n")
    $ms.Write($obj5Head, 0, $obj5Head.Length)
    $ms.Write($jpegBytes, 0, $jpegBytes.Length)
    $obj5Foot = [System.Text.Encoding]::ASCII.GetBytes("`nendstream`nendobj`n")
    $ms.Write($obj5Foot, 0, $obj5Foot.Length)

    # XRef Table
    $xrefPos = $ms.Position
    $xrefHead = [System.Text.Encoding]::ASCII.GetBytes("xref`n0 6`n0000000000 65535 f `n")
    $ms.Write($xrefHead, 0, $xrefHead.Length)

    foreach ($offset in $offsets) {
        $line = "{0:D10} 00000 n `n" -f $offset
        $lineBytes = [System.Text.Encoding]::ASCII.GetBytes($line)
        $ms.Write($lineBytes, 0, $lineBytes.Length)
    }

    # Trailer
    $trailer = [System.Text.Encoding]::ASCII.GetBytes("trailer`n<< /Size 6 /Root 1 0 R >>`nstartxref`n$xrefPos`n%%EOF`n")
    $ms.Write($trailer, 0, $trailer.Length)

    [System.IO.File]::WriteAllBytes($PdfPath, $ms.ToArray())
    $ms.Dispose()
    Write-Host "Created PDF: $PdfPath"
}

$dir = "F:\menza-pos-web\public\dummy-invoices"
Convert-JpegToPdf "$dir\sabzi_mandi_hindi_invoice.jpg" "$dir\sabzi_mandi_hindi_invoice.pdf" 750 1050
Convert-JpegToPdf "$dir\dairy_bilingual_invoice.jpg" "$dir\dairy_bilingual_invoice.pdf" 800 1100
