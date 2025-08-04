# Family Expense Tracker

Sistema completo per il tracciamento delle spese familiari con backend FastAPI, frontend web e app mobile PWA, ottimizzato per Raspberry Pi e uso locale.

## 🏗️ Architettura

- **Backend**: FastAPI + SQLite (Python)
- **Frontend Web**: HTML + CSS + JavaScript + Chart.js
- **Mobile App**: Progressive Web App (PWA)
- **Deployment**: Docker + nginx per Raspberry Pi

## 📁 Struttura Progetto

```
Family_Tracker/
├── backend/                 # API server FastAPI
│   ├── main.py             # Server principale
│   └── requirements.txt    # Dipendenze Python
├── frontend/               # Dashboard web
│   ├── index.html          # Interfaccia principale
│   ├── style.css           # Stili CSS
│   └── app.js              # Logica JavaScript
├── mobile/                 # App mobile PWA
│   ├── index.html          # Interfaccia mobile
│   ├── mobile-style.css    # Stili mobile
│   ├── mobile-app.js       # Logica mobile + offline
│   ├── manifest.json       # Configurazione PWA
│   └── sw.js               # Service Worker
├── docker-compose.yml      # Orchestrazione Docker
├── Dockerfile.backend      # Container backend
├── Dockerfile.frontend     # Container frontend
└── nginx.conf              # Configurazione proxy
```

## 🚀 Avvio Sviluppo Locale

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend (sviluppo)
Apri `frontend/index.html` in un browser o usa un server locale:
```bash
cd frontend
python -m http.server 3000
```

### 3. Mobile (sviluppo)
Apri `mobile/index.html` in un browser o usa:
```bash
cd mobile
python -m http.server 3001
```

## 🐳 Deployment Produzione (Raspberry Pi)

### Con Docker Compose (Raccomandato)
```bash
# Clone/copia il progetto sul Raspberry Pi
git clone <repository>
cd Family_Tracker

# Avvia tutti i servizi
docker-compose up -d

# Verifica status
docker-compose ps
```

### Manuale
```bash
# Backend
docker build -f Dockerfile.backend -t family-tracker-backend .
docker run -d -p 8000:8000 -v ./data:/app/data family-tracker-backend

# Frontend
docker build -f Dockerfile.frontend -t family-tracker-frontend .
docker run -d -p 80:80 family-tracker-frontend
```

## 📱 Utilizzo

### Web Dashboard (Desktop)
- Accedi a `http://[IP_RASPBERRY]:80`
- Aggiungi spese, visualizza report mensili
- Grafici per categoria e utente
- Gestione categorie e modifica spese

### Mobile App (Smartphone)
- Accedi a `http://[IP_RASPBERRY]:80/mobile`
- Interfaccia ottimizzata per mobile
- Funziona offline con sincronizzazione automatica
- Installabile come PWA

## 🔧 API Endpoints

### Autenticazione
Tutte le API richiedono header: `X-Token: family_secret_token`

### Spese
- `POST /expenses` - Aggiungi spesa
- `GET /expenses` - Lista spese
- `PUT /expenses/{id}` - Modifica spesa
- `DELETE /expenses/{id}` - Elimina spesa

### Report
- `GET /reports/monthly?year=YYYY&month=MM` - Report mensile

### Categorie
- `GET /categories` - Lista categorie
- `POST /categories` - Aggiungi categoria
- `DELETE /categories/{id}` - Elimina categoria

### Utenti
- `GET /users` - Lista utenti predefiniti

## 🛠️ Personalizzazione

### Utenti
Modifica l'array `USERS` in `backend/main.py`:
```python
USERS = ["Papà", "Mamma", "Figlio1", "Figlio2"]
```

### Token di Sicurezza
Modifica `SHARED_SECRET` in `backend/main.py` e corrispondenti frontend/mobile

### Valute
Aggiungi opzioni nei select currency in `frontend/index.html` e `mobile/index.html`

## 🔒 Sicurezza

- Autenticazione tramite token condiviso
- CORS configurato per LAN
- Database SQLite locale
- Nessuna dipendenza cloud

## 📊 Funzionalità

### Backend
- ✅ CRUD completo spese
- ✅ Gestione categorie
- ✅ Report mensili aggregati
- ✅ Database SQLite
- ✅ API REST con autenticazione

### Frontend Web
- ✅ Dashboard con grafici (Chart.js)
- ✅ Form aggiunta spese
- ✅ Lista spese recenti
- ✅ Report mensili interattivi
- ✅ Gestione categorie
- ✅ Design responsive

### Mobile PWA
- ✅ Interfaccia mobile ottimizzata
- ✅ Funzionalità offline
- ✅ Sincronizzazione automatica
- ✅ Installabile come app
- ✅ Service Worker per cache

### Deployment
- ✅ Docker containers
- ✅ nginx reverse proxy
- ✅ Orchestrazione Docker Compose
- ✅ Configurazione Raspberry Pi

## 🔧 Troubleshooting

### Backend non si avvia
- Verifica Python 3.11+ installato
- Controlla dipendenze: `pip install -r requirements.txt`
- Verifica porta 8000 libera

### Frontend non si connette al backend
- Controlla URL API in `app.js` e `mobile-app.js`
- Verifica token di autenticazione
- Controlla CORS nel backend

### Docker issues
- Verifica Docker installato e avviato
- Controlla porte non occupate (80, 8000)
- Verifica permessi cartella `./data`

## 📝 TODO / Miglioramenti Futuri

- [ ] Autenticazione utenti individuali
- [ ] Export dati CSV/Excel
- [ ] Notifiche push mobile
- [ ] Backup automatico database
- [ ] Dashboard più avanzata con filtri
- [ ] API per import dati da banche
- [ ] Temi personalizzabili
- [ ] Multi-lingua

## 📄 Licenza

MIT License - Vedi file LICENSE per dettagli.
