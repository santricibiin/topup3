$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$zip = Join-Path $root 'ptopup-build.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

# Build folder + minimal files yg dibutuhin runtime production.
# node_modules tetap di-install di server (karena Cloudlinux maksa).
$exclude = @(
    'node_modules',
    '\.next[/\\]cache',
    '\.git',
    'public[/\\]uploads',
    'ptopup-deploy\.zip',
    'PTOPUP\.zip',
    'ptopup-build\.zip',
    'tsconfig\.tsbuildinfo',
    'danaapi\.js',
    'qristodinamis\.js',
    'promt\.txt',
    'scripts[/\\]make-zip\.ps1'
)
$pattern = ($exclude -join '|')

$files = Get-ChildItem -Path $root -Recurse -Force -File |
    Where-Object { $_.FullName -notmatch $pattern -and $_.Name -ne '.env' }

Write-Host ("Files to zip: " + $files.Count)

$paths = @($files | ForEach-Object { $_.FullName })
Compress-Archive -Path $paths -DestinationPath $zip -CompressionLevel Optimal

$size = (Get-Item $zip).Length / 1MB
Write-Host ("Zip size: " + [math]::Round($size, 2) + " MB")
