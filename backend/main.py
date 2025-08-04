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

# API Utenti (predefiniti)
USERS = ["Dad", "Mom", "Kid1", "Kid2"]

@app.get("/users", dependencies=[Depends(check_auth)])
def get_users():
    return USERS

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
