#!/bin/bash

# Family Tracker - Setup Scripts
# Comando da eseguire sul Raspberry Pi per rendere gli script eseguibili

chmod +x pi-scripts/*.sh

echo "Script resi eseguibili!"
echo ""
echo "Comandi disponibili:"
echo "  ./pi-scripts/start-family-tracker-portforward.sh  # Avvia i servizi"
echo "  ./pi-scripts/stop-family-tracker.sh               # Ferma i servizi"  
echo "  ./pi-scripts/status-family-tracker.sh             # Controlla lo status"
