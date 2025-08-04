from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import os
from datetime import datetime

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
    
    # Aggiungi utenti di default se non esistono
    default_users = ["Dad", "Mom", "Kid1", "Kid2"]
    for user in default_users:
        try:
            c.execute("INSERT OR IGNORE INTO users (name) VALUES (?)", (user,))
        except:
            pass
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
        
        # Conta categorie
        c.execute("SELECT COUNT(*) FROM categories")
        category_count = c.fetchone()[0]
        
        # Conta utenti
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]
        
        # Totale speso per valuta
        c.execute("SELECT currency, SUM(amount) FROM expenses GROUP BY currency")
        currency_totals = {row[0]: row[1] for row in c.fetchall()}
        
        # Spese per utente
        c.execute("SELECT user, COUNT(*), SUM(amount) FROM expenses GROUP BY user")
        user_stats = [{"user": row[0], "count": row[1], "total": row[2]} for row in c.fetchall()]
        
        conn.close()
        
        return {
            "expense_count": expense_count,
            "category_count": category_count,
            "user_count": user_count,
            "currency_totals": currency_totals,
            "user_stats": user_stats
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

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
    uvicorn.run(app, host="0.0.0.0", port=8082, log_level="info")
