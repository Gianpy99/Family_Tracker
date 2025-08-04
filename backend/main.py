from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import os
import logging
from datetime import datetime, timedelta
import ipaddress
from collections import defaultdict
import time

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log'),
        logging.StreamHandler()
    ]
)

# Sistema di sicurezza avanzato
BLOCKED_IPS = set()
REQUEST_COUNTS = defaultdict(list)
SUSPICIOUS_PATTERNS = [
    'CONNECT', 'PROPFIND', 'MKCOL', 'OPTIONS', 'TRACE',
    '.php', '.asp', '.jsp', 'wp-admin', 'phpMyAdmin',
    'admin/config', '/config', '/setup', '/install'
]

# Rate limiting: max 1000 richieste per IP in 10 minuti (aumentato per debugging)
MAX_REQUESTS_PER_IP = 1000
TIME_WINDOW = 600  # 10 minuti

def is_ip_blocked(ip: str) -> bool:
    """Controlla se un IP è bloccato"""
    return ip in BLOCKED_IPS

def is_rate_limited(ip: str) -> bool:
    """Controlla rate limiting per IP"""
    now = time.time()
    # Rimuovi richieste vecchie
    REQUEST_COUNTS[ip] = [req_time for req_time in REQUEST_COUNTS[ip] if now - req_time < TIME_WINDOW]
    
    # Aggiungi richiesta corrente
    REQUEST_COUNTS[ip].append(now)
    
    # Controlla se supera il limite
    if len(REQUEST_COUNTS[ip]) > MAX_REQUESTS_PER_IP:
        BLOCKED_IPS.add(ip)
        logging.warning(f"🚫 IP {ip} blocked for rate limiting ({len(REQUEST_COUNTS[ip])} requests)")
        return True
    
    return False

def is_suspicious_request(request: Request) -> bool:
    """Rileva richieste sospette - versione ridotta per stabilità"""
    path = str(request.url.path).lower()
    method = request.method.upper()
    user_agent = request.headers.get('user-agent', '').lower()
    
    # Solo pattern veramente pericolosi
    dangerous_patterns = ['.php', '.asp', '.jsp', 'wp-admin', 'phpMyAdmin']
    for pattern in dangerous_patterns:
        if pattern.lower() in path:
            return True
    
    # Ignoriamo user agent sospetti per ora (troppo restrittivo)
    # suspicious_agents = ['curl', 'wget', 'scanner', 'bot', 'crawler']
    # for agent in suspicious_agents:
    #     if agent in user_agent and 'googlebot' not in user_agent:
    #         return True
    
    return False

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log'),
        logging.StreamHandler()
    ]
)

# Configurazione
SHARED_SECRET = "family_secret_token"
DB_PATH = os.getenv("DB_PATH", "./expenses.db")

# Modelli
class Expense(BaseModel):
    id: Optional[int] = None
    date: str
    category: str
    amount: float
    currency: str
    user: str

class Category(BaseModel):
    id: Optional[int] = None
    name: str

class User(BaseModel):
    name: str

class UpdateExpense(BaseModel):
    id: int
    date: str
    category: str
    amount: float
    currency: str
    user: str

# Modelli Entrate
class Income(BaseModel):
    id: Optional[int] = None
    date: str
    category: str
    amount: float
    currency: str
    user: str

class UpdateIncome(BaseModel):
    id: int
    date: str
    category: str
    amount: float
    currency: str
    user: str

# FastAPI app
app = FastAPI()

# Middleware di sicurezza semplificato per stabilità
@app.middleware("http")
async def advanced_security_middleware(request: Request, call_next):
    client_ip = request.client.host
    method = request.method
    path = request.url.path
    
    # 1. Controlla IP bloccati
    if is_ip_blocked(client_ip):
        logging.warning(f"🚫 Blocked IP attempted access: {client_ip} - {method} {path}")
        return JSONResponse(status_code=403, content={"error": "Access denied"})
    
    # 2. Rate limiting (solo per IP veramente problematici)
    if is_rate_limited(client_ip):
        logging.warning(f"🚫 Rate limited IP: {client_ip} - {method} {path}")
        return JSONResponse(status_code=429, content={"error": "Too many requests"})
    
    # 3. Solo richieste veramente pericolose
    if is_suspicious_request(request):
        BLOCKED_IPS.add(client_ip)
        logging.warning(f"🚨 DANGEROUS REQUEST BLOCKED: {client_ip} - {method} {path}")
        return JSONResponse(status_code=403, content={"error": "Suspicious activity detected"})
    
    # Rimuoviamo controlli troppo restrittivi per ora:
    # - Controllo caratteri non ASCII
    # - Controllo metodi HTTP 
    # - Controllo lunghezza URL
    
    # Log richieste legittime (solo per debug)
    if path not in ['/health', '/favicon.ico'] and 'admin' not in path:
        logging.info(f"✅ Request: {client_ip} - {method} {path}")
    
    response = await call_next(request)
    return response

# CORS per frontend/mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def check_auth(x_token: str = Header(...)):
    if x_token != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Handler per errori di validazione
@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc):
    logging.warning(f"Errore di validazione da {request.client.host}: {exc}")
    return JSONResponse(status_code=400, content={"error": "Invalid request format"})

# Handler per errori generali
@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logging.error(f"Errore interno da {request.client.host}: {exc}")
    return JSONResponse(status_code=500, content={"error": "Internal server error"})

# Inizializzazione DB
@app.on_event("startup")
def startup():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        amount REAL,
        currency TEXT,
        user TEXT
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )
    """)
    
    # Creare tabella utenti
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    """)
    
    # Aggiungi categorie di default se non esistono
    default_categories = [
        "Spesa", "Benzina", "Ristorante", "Bollette", "Casa", 
        "Salute", "Sport", "Svago", "Abbigliamento", "Trasporti"
    ]
    
    for category in default_categories:
        try:
            c.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (category,))
        except:
            pass
    
    # Non creare più utenti di default - gli utenti vengono gestiti dall'admin
    
    # Crea tabella per le entrate
    c.execute("""
    CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        amount REAL,
        currency TEXT,
        user TEXT
    )
    """)
    
    conn.commit()
    conn.close()


# API Spese
@app.post("/expenses", dependencies=[Depends(check_auth)])
def add_expense(expense: Expense):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO expenses (date, category, amount, currency, user) VALUES (?, ?, ?, ?, ?)",
        (expense.date, expense.category, expense.amount, expense.currency, expense.user)
    )
    conn.commit()
    expense_id = c.lastrowid
    conn.close()
    return {"status": "ok", "id": expense_id}

@app.get("/expenses", response_model=List[Expense], dependencies=[Depends(check_auth)])
def list_expenses():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM expenses ORDER BY date DESC")
    rows = c.fetchall()
    conn.close()
    return [Expense(**dict(row)) for row in rows]

# Modifica spesa
@app.put("/expenses/{expense_id}", dependencies=[Depends(check_auth)])
def update_expense(expense_id: int, expense: Expense):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "UPDATE expenses SET date=?, category=?, amount=?, currency=?, user=? WHERE id=?",
        (expense.date, expense.category, expense.amount, expense.currency, expense.user, expense_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}

# Elimina spesa
@app.delete("/expenses/{expense_id}", dependencies=[Depends(check_auth)])
def delete_expense(expense_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# ========== API ENTRATE ==========

@app.post("/incomes", dependencies=[Depends(check_auth)])
def add_income(income: Income):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO incomes (date, category, amount, currency, user) VALUES (?, ?, ?, ?, ?)",
        (income.date, income.category, income.amount, income.currency, income.user)
    )
    conn.commit()
    income_id = c.lastrowid
    conn.close()
    return {"status": "ok", "id": income_id}

@app.get("/incomes", response_model=List[Income], dependencies=[Depends(check_auth)])
def list_incomes():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM incomes ORDER BY date DESC")
    rows = c.fetchall()
    conn.close()
    return [Income(**dict(row)) for row in rows]

@app.put("/incomes/{income_id}", dependencies=[Depends(check_auth)])
def update_income(income_id: int, income: Income):
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "UPDATE incomes SET date=?, category=?, amount=?, currency=?, user=? WHERE id=?",
        (income.date, income.category, income.amount, income.currency, income.user, income_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/incomes/{income_id}", dependencies=[Depends(check_auth)])
def delete_income(income_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM incomes WHERE id = ?", (income_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# Report mensile per categoria, utente, valuta
@app.get("/reports/monthly", dependencies=[Depends(check_auth)])
def monthly_report(year: int, month: int):
    conn = get_db()
    c = conn.cursor()
    start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end = f"{year+1:04d}-01-01"
    else:
        end = f"{year:04d}-{month+1:02d}-01"
    # Totali per categoria
    c.execute("""
        SELECT category, currency, SUM(amount) as total
        FROM expenses
        WHERE date >= ? AND date < ?
        GROUP BY category, currency
    """, (start, end))
    by_category = [dict(row) for row in c.fetchall()]
    # Totali per utente
    c.execute("""
        SELECT user, currency, SUM(amount) as total
        FROM expenses
        WHERE date >= ? AND date < ?
        GROUP BY user, currency
    """, (start, end))
    by_user = [dict(row) for row in c.fetchall()]
    # Totali per giorno
    c.execute("""
        SELECT date, currency, SUM(amount) as total
        FROM expenses
        WHERE date >= ? AND date < ?
        GROUP BY date, currency
    """, (start, end))
    by_date = [dict(row) for row in c.fetchall()]
    conn.close()
    return {"by_category": by_category, "by_user": by_user, "by_date": by_date}

# API Categorie
@app.get("/categories", response_model=List[Category], dependencies=[Depends(check_auth)])
def get_categories():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM categories")
    rows = c.fetchall()
    conn.close()
    return [Category(**dict(row)) for row in rows]

@app.post("/categories", dependencies=[Depends(check_auth)])
def add_category(category: Category):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO categories (name) VALUES (?)", (category.name,))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Category already exists")
    finally:
        conn.close()
    return {"status": "ok"}

@app.delete("/categories/{category_id}", dependencies=[Depends(check_auth)])
def delete_category(category_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# API Utenti
@app.get("/users", dependencies=[Depends(check_auth)])
def get_users():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM users ORDER BY name")
    users = [row[0] for row in c.fetchall()]
    conn.close()
    return users

# ========== ADMIN ENDPOINTS ==========

# Reset completo database
@app.post("/admin/reset", dependencies=[Depends(check_auth)])
def reset_database():
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Elimina tutti i dati
        c.execute("DELETE FROM expenses")
        c.execute("DELETE FROM incomes")
        c.execute("DELETE FROM categories")
        c.execute("DELETE FROM users")
        
        # Reinserisci dati di default
        default_categories = [
            "Spesa", "Benzina", "Ristorante", "Bollette", "Casa", 
            "Salute", "Sport", "Svago", "Abbigliamento", "Trasporti"
        ]
        for category in default_categories:
            c.execute("INSERT INTO categories (name) VALUES (?)", (category,))
        
        default_users = ["Dad", "Mom", "Kid1", "Kid2"]
        for user in default_users:
            c.execute("INSERT INTO users (name) VALUES (?)", (user,))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Database reset completato"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Modifica spesa esistente
@app.put("/admin/expenses/{expense_id}", dependencies=[Depends(check_auth)])
def update_expense(expense_id: int, expense: UpdateExpense):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("""
            UPDATE expenses 
            SET date=?, category=?, amount=?, currency=?, user=?
            WHERE id=?
        """, (expense.date, expense.category, expense.amount, expense.currency, expense.user, expense_id))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Spesa non trovata")
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Spesa {expense_id} aggiornata"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Elimina spesa
@app.delete("/admin/expenses/{expense_id}", dependencies=[Depends(check_auth)])
def delete_expense(expense_id: int):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Spesa non trovata")
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Spesa {expense_id} eliminata"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Gestione entrate admin - Modifica
@app.put("/admin/incomes/{income_id}", dependencies=[Depends(check_auth)])  
def update_income_admin(income_id: int, income: UpdateIncome):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("""UPDATE incomes 
                     SET date=?, category=?, amount=?, currency=?, user=? 
                     WHERE id=?""", 
                  (income.date, income.category, income.amount, income.currency, income.user, income_id))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Entrata non trovata")
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Entrata {income_id} modificata"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Gestione entrate admin - Elimina
@app.delete("/admin/incomes/{income_id}", dependencies=[Depends(check_auth)])
def delete_income_admin(income_id: int):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM incomes WHERE id=?", (income_id,))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Entrata non trovata")
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Entrata {income_id} eliminata"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Gestione utenti - Aggiungi
@app.post("/admin/users", dependencies=[Depends(check_auth)])
def add_user(user: User):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (name) VALUES (?)", (user.name,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Utente '{user.name}' aggiunto"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Utente già esistente")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Gestione utenti - Modifica nome
@app.put("/admin/users/{old_name}", dependencies=[Depends(check_auth)])
def update_user(old_name: str, user: User):
    conn = get_db()
    c = conn.cursor()
    try:
        # Aggiorna nome utente
        c.execute("UPDATE users SET name=? WHERE name=?", (user.name, old_name))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Aggiorna anche le spese associate
        c.execute("UPDATE expenses SET user=? WHERE user=?", (user.name, old_name))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Utente '{old_name}' rinominato in '{user.name}'"}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Nome utente già esistente")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Gestione utenti - Elimina
@app.delete("/admin/users/{user_name}", dependencies=[Depends(check_auth)])
def delete_user(user_name: str):
    conn = get_db()
    c = conn.cursor()
    try:
        # Controlla se l'utente ha spese associate
        c.execute("SELECT COUNT(*) FROM expenses WHERE user=?", (user_name,))
        expense_count = c.fetchone()[0]
        
        if expense_count > 0:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Impossibile eliminare utente: ha {expense_count} spese associate")
        
        # Elimina utente
        c.execute("DELETE FROM users WHERE name=?", (user_name,))
        
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Utente '{user_name}' eliminato"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Statistiche database
@app.get("/admin/stats", dependencies=[Depends(check_auth)])
def get_database_stats():
    conn = get_db()
    c = conn.cursor()
    try:
        # Conta spese
        c.execute("SELECT COUNT(*) FROM expenses")
        expense_count = c.fetchone()[0]
        
        # Conta entrate
        c.execute("SELECT COUNT(*) FROM incomes")
        income_count = c.fetchone()[0]
        
        # Conta categorie
        c.execute("SELECT COUNT(*) FROM categories")
        category_count = c.fetchone()[0]
        
        # Conta utenti
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]
        
        # Totale speso per valuta
        c.execute("SELECT currency, SUM(amount) FROM expenses GROUP BY currency")
        expense_totals = {row[0]: row[1] for row in c.fetchall()}
        
        # Totale entrate per valuta
        c.execute("SELECT currency, SUM(amount) FROM incomes GROUP BY currency")
        income_totals = {row[0]: row[1] for row in c.fetchall()}
        
        # Spese per utente
        c.execute("SELECT user, COUNT(*), SUM(amount) FROM expenses GROUP BY user")
        expense_user_stats = [{"user": row[0], "count": row[1], "total": row[2]} for row in c.fetchall()]
        
        # Entrate per utente
        c.execute("SELECT user, COUNT(*), SUM(amount) FROM incomes GROUP BY user")
        income_user_stats = [{"user": row[0], "count": row[1], "total": row[2]} for row in c.fetchall()]
        
        conn.close()
        
        return {
            "expense_count": expense_count,
            "income_count": income_count,
            "category_count": category_count,
            "user_count": user_count,
            "expense_totals": expense_totals,
            "income_totals": income_totals,
            "expense_user_stats": expense_user_stats,
            "income_user_stats": income_user_stats
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# Security monitoring endpoint
@app.get("/admin/security", dependencies=[Depends(check_auth)])
def get_security_stats():
    """Statistiche di sicurezza per amministratori"""
    total_blocked = len(BLOCKED_IPS)
    recent_requests = sum(len(requests) for requests in REQUEST_COUNTS.values())
    
    # Top IP con più richieste
    top_ips = sorted(
        [(ip, len(requests)) for ip, requests in REQUEST_COUNTS.items()],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    
    return {
        "blocked_ips_count": total_blocked,
        "blocked_ips": list(BLOCKED_IPS)[:20],  # Mostra solo i primi 20
        "active_connections": recent_requests,
        "top_requesting_ips": top_ips,
        "security_events": {
            "rate_limited": len([ip for ip in BLOCKED_IPS if len(REQUEST_COUNTS.get(ip, [])) > MAX_REQUESTS_PER_IP//2]),
            "suspicious_patterns": len([ip for ip in BLOCKED_IPS])
        }
    }

@app.post("/admin/unblock-ip", dependencies=[Depends(check_auth)])
def unblock_ip(request: dict):
    """Sblocca un IP specifico"""
    ip_to_unblock = request.get("ip")
    if not ip_to_unblock:
        raise HTTPException(status_code=400, detail="IP address required")
    
    if ip_to_unblock in BLOCKED_IPS:
        BLOCKED_IPS.remove(ip_to_unblock)
        if ip_to_unblock in REQUEST_COUNTS:
            REQUEST_COUNTS[ip_to_unblock] = []
        logging.info(f"✅ IP {ip_to_unblock} unblocked by admin")
        return {"message": f"IP {ip_to_unblock} successfully unblocked"}
    else:
        return {"message": f"IP {ip_to_unblock} was not blocked"}

@app.post("/admin/reset-security", dependencies=[Depends(check_auth)])
def reset_security():
    """Reset completo del sistema di sicurezza"""
    global BLOCKED_IPS, REQUEST_COUNTS
    
    blocked_count = len(BLOCKED_IPS)
    BLOCKED_IPS.clear()
    REQUEST_COUNTS.clear()
    
    logging.info(f"🔄 Security system reset - {blocked_count} IPs unblocked")
    return {
        "message": f"Security system reset successfully", 
        "unblocked_ips": blocked_count
    }

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Family Tracker Backend is running"}

# Avvio del server
if __name__ == "__main__":
    import uvicorn
    print("🚀 Avvio Family Tracker Backend...")
    print(f"📊 Database: {DB_PATH}")
    print(f"🔑 Token: {SHARED_SECRET}")
    print(f"🛡️ Security: Rate limiting enabled ({MAX_REQUESTS_PER_IP} req/10min)")
    uvicorn.run(app, host="0.0.0.0", port=8082, log_level="info")
