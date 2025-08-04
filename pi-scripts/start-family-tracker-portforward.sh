#!/bin/bash

# Family Tracker - Avvio con Port Forwarding
# Script per Raspberry Pi

echo "Avvio Family Tracker con Port Forwarding..."

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directory del progetto (auto-detect dalla posizione dello script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/venv"

# Controlla se la directory esiste
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Directory progetto non trovata: $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Assicurati di essere nella directory corretta del progetto${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# Controlla se il virtual environment esiste
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Creazione virtual environment...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install fastapi uvicorn jinja2 python-multipart
else
    echo -e "${GREEN}Virtual environment trovato${NC}"
    source venv/bin/activate
fi

# Controlla IP del Raspberry Pi
PI_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}IP Raspberry Pi: $PI_IP${NC}"
echo -e "${BLUE}IP Pubblico: 88.98.239.238${NC}"

# Avvia il backend
echo -e "${YELLOW}Avvio backend FastAPI...${NC}"
cd backend
python main.py &
BACKEND_PID=$!
echo -e "${GREEN}Backend avviato (PID: $BACKEND_PID) - Porta 8082${NC}"

# Attendi che il backend sia pronto
sleep 3

# Avvia il frontend
echo -e "${YELLOW}Avvio frontend...${NC}"
cd ../
python -m http.server 8090 &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend avviato (PID: $FRONTEND_PID) - Porta 8090${NC}"

echo ""
echo -e "${GREEN}Family Tracker avviato con successo!${NC}"
echo ""
echo -e "${BLUE}Accesso Locale:${NC}"
echo -e "   Frontend: http://$PI_IP:8090/frontend/"
echo -e "   Backend:  http://$PI_IP:8082"
echo -e "   Mobile PWA: http://$PI_IP:8090/mobile/"
echo ""
echo -e "${BLUE}Accesso Esterno (Port Forwarding):${NC}"
echo -e "   Frontend: http://88.98.239.238:8090/frontend/"
echo -e "   Backend:  http://88.98.239.238:8082"
echo -e "   Mobile PWA: http://88.98.239.238:8090/mobile/"
echo ""
echo -e "${YELLOW}PIDs dei processi:${NC}"
echo -e "   Backend: $BACKEND_PID"
echo -e "   Frontend: $FRONTEND_PID"
echo ""
echo -e "${YELLOW}Per fermare i servizi:${NC}"
echo -e "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${BLUE}Premi Ctrl+C per vedere i logs in tempo reale${NC}"

# Funzione per gestire il segnale SIGINT (Ctrl+C)
cleanup() {
    echo ""
    echo -e "${YELLOW}Arresto servizi...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Servizi arrestati${NC}"
    exit 0
}

# Cattura il segnale SIGINT
trap cleanup SIGINT

# Mantieni lo script attivo e mostra i logs
echo -e "${BLUE}Logs in tempo reale (Ctrl+C per uscire):${NC}"
echo ""
wait
