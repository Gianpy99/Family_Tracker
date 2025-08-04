#!/bin/bash

# Family Tracker - Stop Script
# Script per fermare tutti i servizi

echo "🛑 Arresto Family Tracker..."

# Trova e termina i processi Python
echo "🔍 Ricerca processi Family Tracker..."

# Termina il backend FastAPI
BACKEND_PIDS=$(ps aux | grep "python.*main.py" | grep -v grep | awk '{print $2}')
if [ ! -z "$BACKEND_PIDS" ]; then
    echo "🔧 Arresto backend FastAPI..."
    echo "$BACKEND_PIDS" | xargs kill -TERM
    echo "✅ Backend arrestato"
fi

# Termina il frontend HTTP server
FRONTEND_PIDS=$(ps aux | grep "python.*http.server.*8090" | grep -v grep | awk '{print $2}')
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo "🌐 Arresto frontend HTTP server..."
    echo "$FRONTEND_PIDS" | xargs kill -TERM
    echo "✅ Frontend arrestato"
fi

# Termina eventuali altri processi sulla porta 8082 e 8090
echo "🧹 Pulizia porte..."
sudo lsof -ti:8082 | xargs sudo kill -9 2>/dev/null || true
sudo lsof -ti:8090 | xargs sudo kill -9 2>/dev/null || true

echo "🎉 Family Tracker arrestato completamente!"
