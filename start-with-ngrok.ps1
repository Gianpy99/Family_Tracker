# Script per avviare Family Tracker con ngrok multipli tunnel
Write-Host "🚀 Avvio Family Tracker con ngrok (multi-tunnel)..." -ForegroundColor Green

# Controlla se ngrok è disponibile
if (!(Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok non trovato! Installalo da: https://ngrok.com/" -ForegroundColor Red
    Write-Host "💡 Dopo l'installazione, configura il token con: ngrok authtoken YOUR_TOKEN" -ForegroundColor Yellow
    exit 1
}

# Termina eventuali processi precedenti
Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*Family_Tracker*"} | Stop-Process -Force
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

# Avvia backend FastAPI
Write-Host "🔧 Avvio backend FastAPI..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "python" -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8082") -WorkingDirectory $PWD -PassThru

# Avvia frontend web
Write-Host "🌐 Avvio frontend web..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "8090", "--bind", "0.0.0.0") -WorkingDirectory "$PWD/frontend" -PassThru

# Aspetta che i server si avviino
Start-Sleep -Seconds 5

# Test connessione locale
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8082/expenses" -Headers @{"X-Token"="family_secret_token"} -TimeoutSec 5
    Write-Host "✅ Backend risponde correttamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non risponde: $($_.Exception.Message)" -ForegroundColor Red
}

# Avvia ngrok per il frontend (mobile app)
Write-Host "🌍 Avvio ngrok per frontend mobile..." -ForegroundColor Cyan
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "📱 IMPORTANTE: Usa l'URL ngrok che appare" -ForegroundColor Green
Write-Host "   per accedere all'app mobile da remoto" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# Funzione di cleanup
function Cleanup {
    Write-Host "🛑 Fermando processi..." -ForegroundColor Red
    if ($backendProcess -and !$backendProcess.HasExited) { $backendProcess.Kill() }
    if ($frontendProcess -and !$frontendProcess.HasExited) { $frontendProcess.Kill() }
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
}

# Registra cleanup per Ctrl+C
Register-EngineEvent PowerShell.Exiting –Action { Cleanup }

try {
    # Avvia ngrok
    ngrok http 8090 --host-header="localhost:8090"
} finally {
    Cleanup
}
