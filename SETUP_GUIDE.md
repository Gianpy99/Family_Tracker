# 🚀 Family Expense Tracker - Setup Completo

## 📱 Modalità Offline (Migliorata)

L'app ora ha:
- ✅ **Sync automatico** ogni 30 secondi quando online
- ✅ **Pulsante sync manuale** per forzare la sincronizzazione
- ✅ **Indicatori visivi** precisi dello stato di sync
- ✅ **Gestione errori** avanzata con retry automatici
- ✅ **Logging dettagliato** per debugging

### Come Funziona:
1. **Offline**: Spese salvate localmente con icona ⚠️
2. **Online**: Sync automatico + pulsante manuale visibile se ci sono spese in coda
3. **Ritorno a casa**: Sync automatico immediato + conferma

## 🌐 Setup Ngrok (Raspberry Pi)

### Sul Raspberry Pi:

```bash
# 1. Avvia il backend
cd /path/to/Family_Tracker/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8082

# 2. Avvia il frontend  
cd /path/to/Family_Tracker
python -m http.server 8090 --bind 0.0.0.0

# 3. Avvia ngrok (in parallelo)
ngrok http 8090
```

### Configurazione App per Ngrok:

Quando ngrok è attivo, ti darà un URL tipo:
```
https://abc123.ngrok.io
```

## 🔧 Configurazione Dinamica dell'API

L'app rileva automaticamente:
- **Rete locale**: `http://192.168.1.134:8082`
- **Ngrok**: `https://abc123.ngrok.io:8082` (se configurato)

## 📋 Scenario d'Uso Completo

### 1. **A Casa (WiFi locale)**
- App si connette a `http://192.168.1.134:8082`
- Sync in tempo reale
- Dashboard web accessibile

### 2. **Fuori Casa (senza ngrok)**
- App in modalità offline
- Spese salvate localmente
- Sync automatico al ritorno

### 3. **Fuori Casa (con ngrok)**
- App si connette a `https://abc123.ngrok.io`
- Sync in tempo reale ovunque
- Accesso remoto sicuro

## ⚡ Opzioni di Deployment

### Opzione A: Solo Offline (Attuale)
- ✅ Zero configurazione
- ✅ Massima sicurezza
- ✅ Funziona sempre

### Opzione B: Ngrok su Richiesta
- ✅ Avvii ngrok solo quando serve
- ✅ URL temporaneo
- ✅ Spegni quando non serve

### Opzione C: Server Cloud Permanente
- 🚀 Railway/Render deployment
- 🌐 URL fisso tipo `https://family-tracker.railway.app`
- 💰 Gratuito per uso familiare

## 🛠️ Prossimi Step

Dimmi cosa preferisci:

1. **Testare modalità offline migliorata** ✅ (Fatto!)
2. **Setup ngrok automatico** con configurazione dinamica
3. **Deploy su cloud gratuito** per URL fisso
4. **Ibrido**: Offline + ngrok su richiesta

La modalità offline è ora super-solida. Ngrok può essere un "plus" quando serve accesso remoto!
