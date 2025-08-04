#!/bin/bash

# Family Tracker - Status Check
# Script per controllare lo stato dei servizi

echo "Status Family Tracker"
echo "========================"

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Controlla IP
PI_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}IP Raspberry Pi: $PI_IP${NC}"

# Controlla Backend
echo ""
echo -e "${YELLOW}Backend (FastAPI - Porta 8082):${NC}"
BACKEND_PID=$(ps aux | grep "python.*main.py" | grep -v grep | awk '{print $2}')
if [ ! -z "$BACKEND_PID" ]; then
    echo -e "${GREEN}Running (PID: $BACKEND_PID)${NC}"
    echo -e "   URL Locale: http://$PI_IP:8082"
    echo -e "   URL Esterno: http://88.98.239.238:8082"
    
    # Test connessione
    if curl -s "http://localhost:8082/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Health check OK${NC}"
    else
        echo -e "${RED}Health check failed${NC}"
    fi
else
    echo -e "${RED}Not running${NC}"
fi

# Controlla Frontend
echo ""
echo -e "${YELLOW}Frontend (HTTP Server - Porta 8090):${NC}"
FRONTEND_PID=$(ps aux | grep "python.*http.server.*8090" | grep -v grep | awk '{print $2}')
if [ ! -z "$FRONTEND_PID" ]; then
    echo -e "${GREEN}Running (PID: $FRONTEND_PID)${NC}"
    echo -e "   URL Locale: http://$PI_IP:8090"
    echo -e "   URL Esterno: http://88.98.239.238:8090"
    echo -e "   Mobile PWA: http://88.98.239.238:8090/mobile/"
    
    # Test connessione
    if curl -s "http://localhost:8090" > /dev/null 2>&1; then
        echo -e "${GREEN}HTTP server OK${NC}"
    else
        echo -e "${RED}HTTP server failed${NC}"
    fi
else
    echo -e "${RED}Not running${NC}"
fi

# Controlla porte
echo ""
echo -e "${YELLOW}Porte in ascolto:${NC}"
netstat -tlnp 2>/dev/null | grep ":808[029]" | while read line; do
    echo "   $line"
done

# Test Port Forwarding
echo ""
echo -e "${YELLOW}Test Port Forwarding:${NC}"
echo -e "${BLUE}Testa manualmente questi URL dal tuo telefono:${NC}"
echo -e "   http://88.98.239.238:8090 (Frontend)"
echo -e "   http://88.98.239.238:8082/health (Backend)"
echo -e "   http://88.98.239.238:8090/mobile/ (Mobile PWA)"
