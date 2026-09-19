$ErrorActionPreference = "Stop"
$src = "C:\Users\Voyager\CodeBuddy\Claw\report_assets\travel_planner_report.pptx"
$dst = "C:\Users\Voyager\CodeBuddy\Claw\report_assets\travel_planner_report.pdf"

$ppt = New-Object -ComObject PowerPoint.Application
try {
    $pres = $ppt.Presentations.Open($src, $true, $false, $false)
    $pres.SaveAs($dst, 32)
    $pres.Close()
    Write-Output "PDF_CONVERTED_OK"
} finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
if (Test-Path $dst) { Write-Output "PDF size: $((Get-Item $dst).Length)" } else { Write-Output "PDF NOT FOUND" }
