#!/bin/bash

# Family Tracker - Diagnostic Script
# Script per diagnosticare problemi del backend

echo "=== DIAGNOSTICA FAMILY TRACKER BACKEND ==="

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directory del progetto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/venv"

echo -e "${BLUE}1. STRUTTURA DIRECTORY${NC}"
echo "   Script dir: $SCRIPT_DIR"
echo "   Project dir: $PROJECT_DIR"
echo "   Venv dir: $VENV_DIR"
echo ""

echo -e "${BLUE}2. VERIFICA DIRECTORY E FILE${NC}"
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${GREEN}✓ Project directory esiste${NC}"
else
    echo -e "${RED}✗ Project directory NON esiste${NC}"
fi

if [ -d "$PROJECT_DIR/backend" ]; then
    echo -e "${GREEN}✓ Backend directory esiste${NC}"
else
    echo -e "${RED}✗ Backend directory NON esiste${NC}"
    echo "   Contenuto project dir:"
    ls -la "$PROJECT_DIR/"
fi

if [ -f "$PROJECT_DIR/backend/main.py" ]; then
    echo -e "${GREEN}✓ main.py esiste${NC}"
else
    echo -e "${RED}✗ main.py NON esiste${NC}"
    if [ -d "$PROJECT_DIR/backend" ]; then
        echo "   Contenuto backend dir:"
        ls -la "$PROJECT_DIR/backend/"
    fi
fi

echo ""
echo -e "${BLUE}3. VERIFICA VIRTUAL ENVIRONMENT${NC}"
if [ -d "$VENV_DIR" ]; then
    echo -e "${GREEN}✓ Virtual environment esiste${NC}"
    echo "   Path: $VENV_DIR"
    
    # Attiva venv per i test
    source "$VENV_DIR/bin/activate"
    
    if [[ "$VIRTUAL_ENV" != "" ]]; then
        echo -e "${GREEN}✓ Virtual environment attivato${NC}"
        echo "   VIRTUAL_ENV: $VIRTUAL_ENV"
    else
        echo -e "${RED}✗ Virtual environment NON attivato${NC}"
    fi
else
    echo -e "${RED}✗ Virtual environment NON esiste${NC}"
fi

echo ""
echo -e "${BLUE}4. VERIFICA PACCHETTI PYTHON${NC}"
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "   Python version: $(python --version)"
    echo "   Pip version: $(pip --version)"
    
    echo -e "${YELLOW}   Pacchetti installati:${NC}"
    pip list | grep -E "(fastapi|uvicorn|jinja2|python-multipart)" || echo "   Nessun pacchetto Family Tracker trovato"
    
    echo -e "${YELLOW}   Test import pacchetti:${NC}"
    python -c "import fastapi; print('   ✓ FastAPI:', fastapi.__version__)" 2>/dev/null || echo -e "   ${RED}✗ FastAPI non importabile${NC}"
    python -c "import uvicorn; print('   ✓ Uvicorn:', uvicorn.__version__)" 2>/dev/null || echo -e "   ${RED}✗ Uvicorn non importabile${NC}"
    python -c "import jinja2; print('   ✓ Jinja2:', jinja2.__version__)" 2>/dev/null || echo -e "   ${RED}✗ Jinja2 non importabile${NC}"
else
    echo -e "${RED}   Virtual environment non attivo - skip test pacchetti${NC}"
fi

echo ""
echo -e "${BLUE}5. VERIFICA PORTE${NC}"
echo "   Porte in ascolto (8080-8090):"
netstat -tlnp 2>/dev/null | grep ":808[0-9]" || echo "   Nessuna porta 808x in ascolto"

echo ""
echo -e "${BLUE}6. VERIFICA PROCESSI PYTHON${NC}"
echo "   Processi Python attivi:"
ps aux | grep python | grep -v grep | head -5

echo ""
echo -e "${BLUE}7. TEST CONNESSIONE MANUALE${NC}"
if [ -f "$PROJECT_DIR/backend/main.py" ] && [[ "$VIRTUAL_ENV" != "" ]]; then
    echo -e "${YELLOW}   Tentativo di test syntax main.py...${NC}"
    cd "$PROJECT_DIR/backend"
    python -c "
import sys
sys.path.append('.')
try:
    import main
    print('   ✓ main.py importabile')
except Exception as e:
    print(f'   ✗ Errore import main.py: {e}')
" 2>/dev/null || echo -e "   ${RED}✗ Errore nel test syntax${NC}"
else
    echo -e "${RED}   Skip test - file o venv mancanti${NC}"
fi

echo ""
echo -e "${BLUE}8. LOG FILE E ERRORI${NC}"
if [ -f "$PROJECT_DIR/backend/family_tracker.log" ]; then
    echo "   Log file trovato - ultime 5 righe:"
    tail -5 "$PROJECT_DIR/backend/family_tracker.log"
else
    echo "   Nessun log file trovato"
fi

echo ""
echo -e "${YELLOW}=== FINE DIAGNOSTICA ===${NC}"
