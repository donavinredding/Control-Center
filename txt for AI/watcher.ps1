$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $ext = [System.IO.Path]::GetExtension($path)
    
    # Target only html, css, and js files
    if ($ext -in @('.html', '.css', '.js')) {
        Start-Sleep -Milliseconds 500 # Brief pause to ensure file write is complete
        if (Test-Path $path) {
            $newPath = [System.IO.Path]::ChangeExtension($path, '.txt')
            Rename-Item -LiteralPath $path -NewName $newPath -ErrorAction SilentlyContinue
        }
    }
}

Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
Write-Host "Folder watcher active. Press Ctrl+C to stop."
while ($true) { Start-Sleep 1 }