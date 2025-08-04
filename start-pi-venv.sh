#!/bin/bash

# Script per Raspberry Pi con ambiente virtuale e ngrok

echo "🍓 Avvio Family Tracker su Raspberry Pi..."

# Vai nella directory del progetto
cd ~/Family_Tracker

# Attiva ambiente virtuale
echo "🔧 Attivazione ambiente virtuale..."
source family_tracker_env/bin/activate

# Verifica che l'ambiente sia attivo
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "❌ Errore: ambiente virtuale non attivato!"
    exit 1
fi

echo "✅ Ambiente virtuale attivo: $VIRTUAL_ENV"

# Termina eventuali processi precedenti
echo "🧹 Pulizia processi precedenti..."
pkill -f "uvicorn.*main:app" || true
pkill -f "python.*http.server" || true
pkill -f ngrok || true

# Verifica dipendenze
echo "🔍 Verifica dipendenze..."
python -c "import fastapi, uvicorn; print('✅ Dipendenze OK')" || {
    echo "❌ Dipendenze mancanti! Esegui:"
    echo "source family_tracker_env/bin/activate"
    echo "pip install fastapi uvicorn"
    exit 1
}

# Avvia backend FastAPI in background
echo "🔧 Avvio backend FastAPI su porta 8082..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8082 &
BACKEND_PID=$!

# Attendi avvio backend
echo "⏳ Attendo avvio backend..."
sleep 5

# Test backend
echo "🔍 Test backend..."
curl -s -H "X-Token: family_secret_token" http://localhost:8082/expenses > /dev/null && echo "✅ Backend risponde" || echo "⚠️ Backend potrebbe non essere pronto"

# Avvia frontend in background
echo "🌐 Avvio frontend su porta 8090..."
cd frontend
python -m http.server 8090 --bind 0.0.0.0 &
FRONTEND_PID=$!
cd ..

# Attendi avvio frontend
echo "⏳ Attendo avvio frontend..."
sleep 3

# Test frontend
curl -s http://localhost:8090 > /dev/null && echo "✅ Frontend risponde" || echo "⚠️ Frontend potrebbe non essere pronto"

# Mostra informazioni di rete
echo ""
echo "==============================================="
echo "📡 Informazioni di rete:"
echo "   IP locale: $(hostname -I | cut -d' ' -f1)"
echo "   Backend:   http://$(hostname -I | cut -d' ' -f1):8082"
echo "   Frontend:  http://$(hostname -I | cut -d' ' -f1):8090"
echo "==============================================="
echo ""

# Verifica ngrok
if command -v ngrok &> /dev/null; then
    echo "🌍 ngrok trovato! Configurazione dual-tunnel..."
    
    # Avvia ngrok per backend in background
    echo "🔗 Avvio tunnel ngrok per backend (API)..."
    ngrok http 8082 --log=stdout > ngrok-backend.log 2>&1 &
    NGROK_BACKEND_PID=$!
    
    sleep 3
    
    # Avvia ngrok per frontend
    echo "🔗 Avvio tunnel ngrok per frontend..."
    echo ""
    echo "==========================================="
    echo "📱 IMPORTANTE:"
    echo "   Frontend URL: sarà mostrato qui sotto"
    echo "   Backend URL:  controlla ngrok-backend.log"
    echo "==========================================="
    echo ""
    
    # Funzione di cleanup aggiornata
    cleanup() {
        echo ""
        echo "🛑 Fermando tutti i processi..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        kill $NGROK_BACKEND_PID 2>/dev/null || true
        pkill -f ngrok || true
        deactivate 2>/dev/null || true
        echo "👋 Arrivederci!"
        exit 0
    }
    
    # Trap per cleanup
    trap cleanup SIGINT SIGTERM
    
    # Avvia ngrok per frontend (questo bloccherà)
    ngrok http 8090 --host-header="localhost:8090"
    
else
    echo "❌ ngrok non trovato!"
    echo "💡 Per accesso remoto, installa ngrok:"
    echo "   1. Vai su https://ngrok.com/"
    echo "   2. Scarica per Linux ARM"
    echo "   3. Configura il token"
    echo ""
    echo "🌐 Per ora puoi usare l'IP locale:"
    echo "   http://$(hostname -I | cut -d' ' -f1):8090"
    echo ""
    echo "Premi Ctrl+C per fermare i server..."
    wait
fi
