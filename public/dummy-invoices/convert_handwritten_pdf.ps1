. "F:\menza-pos-web\public\dummy-invoices\create_pdfs.ps1"

$dir = "F:\menza-pos-web\public\dummy-invoices"
Convert-JpegToPdf "$dir\handwritten_mandi_parcha.jpg" "$dir\handwritten_mandi_parcha.pdf" 850 1150
Convert-JpegToPdf "$dir\handwritten_dairy_slip.jpg" "$dir\handwritten_dairy_slip.pdf" 850 1100
