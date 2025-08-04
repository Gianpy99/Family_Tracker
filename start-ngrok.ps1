# Script per avviare Family Tracker con ngrok
Write-Host "🚀 Avvio Family Tracker con ngrok..." -ForegroundColor Green

# Controlla se ngrok è disponibile
if (!(Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok non trovato! Installalo da: https://ngrok.com/" -ForegroundColor Red
    exit 1
}

# Avvia backend FastAPI in background
Write-Host "🔧 Avvio backend FastAPI su porta 8082..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList @("backend/main.py") -WorkingDirectory $PWD

# Aspetta che il backend si avvii
Start-Sleep -Seconds 3

# Avvia frontend web in background
Write-Host "🌐 Avvio frontend web su porta 8090..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "8090") -WorkingDirectory "$PWD/frontend"

# Aspetta che il frontend si avvii
Start-Sleep -Seconds 2

# Avvia ngrok per esporre la porta del frontend
Write-Host "🌍 Avvio ngrok per esporre frontend..." -ForegroundColor Cyan
Write-Host "📱 L'app mobile sarà accessibile tramite l'URL ngrok che apparirà" -ForegroundColor Green

# Avvia ngrok (questo bloccherà il terminale)
ngrok http 8090

# Cleanup quando ngrok viene fermato
Write-Host "🛑 Fermando tutti i processi..." -ForegroundColor Red
Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*Family_Tracker*"} | Stop-Process -Force
