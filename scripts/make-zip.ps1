$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$zip = Join-Path $root 'ptopup-deploy.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

$exclude = @(
    'node_modules',
    '\.next',
    '\.git',
    'public[/\\]uploads',
    'ptopup-deploy\.zip',
    'PTOPUP\.zip',
    'tsconfig\.tsbuildinfo',
    'danaapi\.js',
    'qristodinamis\.js',
    'promt\.txt'
)
$pattern = ($exclude -join '|')

$files = Get-ChildItem -Path $root -Recurse -Force -File |
    Where-Object { $_.FullName -notmatch $pattern -and $_.Name -ne '.env' }

Write-Host ("Files to zip: " + $files.Count)

$paths = @($files | ForEach-Object { $_.FullName })
Compress-Archive -Path $paths -DestinationPath $zip -CompressionLevel Optimal

$size = (Get-Item $zip).Length / 1MB
Write-Host ("Zip size: " + [math]::Round($size, 2) + " MB")
