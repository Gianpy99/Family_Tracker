#!/bin/bash

# Family Tracker - Start Backend Only
# Script per avviare solo il backend FastAPI

echo "Avvio solo Backend Family Tracker..."

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

echo -e "${BLUE}Script directory: $SCRIPT_DIR${NC}"
echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"
echo -e "${BLUE}Venv directory: $VENV_DIR${NC}"

# Controlla se la directory esiste
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Directory progetto non trovata: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${BLUE}Changed to directory: $(pwd)${NC}"

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

# Controlla se il virtual environment è attivato
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo -e "${GREEN}Virtual environment attivato: $VIRTUAL_ENV${NC}"
else
    echo -e "${RED}ERRORE: Virtual environment non attivato${NC}"
    exit 1
fi

# Controlla se la directory backend esiste
if [ ! -d "$PROJECT_DIR/backend" ]; then
    echo -e "${RED}Directory backend non trovata: $PROJECT_DIR/backend${NC}"
    echo -e "${YELLOW}Contenuto directory progetto:${NC}"
    ls -la "$PROJECT_DIR/"
    exit 1
fi

# Controlla se main.py esiste
if [ ! -f "$PROJECT_DIR/backend/main.py" ]; then
    echo -e "${RED}File main.py non trovato: $PROJECT_DIR/backend/main.py${NC}"
    echo -e "${YELLOW}Contenuto directory backend:${NC}"
    ls -la "$PROJECT_DIR/backend/"
    exit 1
fi

# Controlla se la porta 8082 è già in uso
if lsof -Pi :8082 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}Porta 8082 già in uso. Termino processo esistente...${NC}"
    sudo lsof -ti:8082 | xargs sudo kill -9 2>/dev/null || true
    sleep 2
fi

# Controlla IP del Raspberry Pi
PI_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}IP Raspberry Pi: $PI_IP${NC}"

# Avvia il backend
echo -e "${YELLOW}Avvio backend FastAPI...${NC}"
cd "$PROJECT_DIR/backend"
echo -e "${BLUE}Directory backend: $(pwd)${NC}"

# Verifica pacchetti installati
echo -e "${YELLOW}Verifica pacchetti Python...${NC}"
python -c "import fastapi; print('FastAPI:', fastapi.__version__)" 2>/dev/null || echo -e "${RED}FastAPI non installato${NC}"
python -c "import uvicorn; print('Uvicorn:', uvicorn.__version__)" 2>/dev/null || echo -e "${RED}Uvicorn non installato${NC}"

# Avvia il backend in modalità debug
echo -e "${YELLOW}Avvio backend in modalità debug...${NC}"
python main.py &
BACKEND_PID=$!

echo -e "${GREEN}Backend avviato (PID: $BACKEND_PID) - Porta 8082${NC}"

# Attendi e testa la connessione
echo -e "${YELLOW}Test connessione backend...${NC}"
sleep 5

# Test health endpoint
if curl -s "http://localhost:8082/health" > /dev/null 2>&1; then
    echo -e "${GREEN}Backend health check OK${NC}"
    echo -e "${BLUE}Backend accessibile su:${NC}"
    echo -e "   http://$PI_IP:8082"
    echo -e "   http://88.98.239.238:8082 (esterno)"
else
    echo -e "${RED}Backend health check FAILED${NC}"
    echo -e "${YELLOW}Controllo logs del processo...${NC}"
    ps aux | grep python | grep main.py
fi

echo ""
echo -e "${BLUE}Premi Ctrl+C per fermare il backend${NC}"

# Funzione per gestire il segnale SIGINT (Ctrl+C)
cleanup() {
    echo ""
    echo -e "${YELLOW}Arresto backend...${NC}"
    kill $BACKEND_PID 2>/dev/null
    echo -e "${GREEN}Backend arrestato${NC}"
    exit 0
}

# Cattura il segnale SIGINT
trap cleanup SIGINT

# Mantieni lo script attivo
wait $BACKEND_PID
