from datetime import datetime, timezone
from pathlib import Path
import random
import sqlite3
import unicodedata
import re
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB = Path(__file__).with_name("books.db")
app = FastAPI(title="Próximo Capítulo API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])

@contextmanager
def connection():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()

def normalize(title: str) -> str:
    value = unicodedata.normalize("NFKD", title.casefold())
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", value)

with connection() as con:
    con.execute("""CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'quero_ler',
        read_at TEXT
    )""")
    con.execute("""CREATE TABLE IF NOT EXISTS draws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        drawn_at TEXT NOT NULL
    )""")

class BookInput(BaseModel):
    title: str = Field(min_length=1, max_length=250)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/books")
def books():
    with connection() as con:
        return [dict(row) for row in con.execute("SELECT * FROM books ORDER BY title COLLATE NOCASE")]

@app.post("/books", status_code=201)
def add_book(book: BookInput):
    title = book.title.strip()
    key = normalize(title)
    if not key:
        raise HTTPException(422, "Informe um título válido.")
    with connection() as con:
        existing = con.execute("SELECT status FROM books WHERE normalized_title=?", (key,)).fetchone()
        if existing:
            place = "Quero Ler" if existing["status"] == "quero_ler" else "Já Li"
            raise HTTPException(409, f"Livro já cadastrado na lista {place}.")
        cur = con.execute("INSERT INTO books(title, normalized_title) VALUES (?, ?)", (title, key))
        return dict(con.execute("SELECT * FROM books WHERE id=?", (cur.lastrowid,)).fetchone())

@app.patch("/books/{book_id}/read")
def mark_read(book_id: int):
    with connection() as con:
        cur = con.execute("UPDATE books SET status='ja_li', read_at=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), book_id))
        if not cur.rowcount:
            raise HTTPException(404, "Livro não encontrado")
        return dict(con.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone())

@app.patch("/books/{book_id}/unread")
def mark_unread(book_id: int):
    with connection() as con:
        cur = con.execute("UPDATE books SET status='quero_ler', read_at=NULL WHERE id=?", (book_id,))
        if not cur.rowcount:
            raise HTTPException(404, "Livro não encontrado")
        return dict(con.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone())

@app.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: int):
    with connection() as con:
        cur = con.execute("DELETE FROM books WHERE id=?", (book_id,))
        if not cur.rowcount:
            raise HTTPException(404, "Livro não encontrado")

@app.post("/draw")
def draw():
    with connection() as con:
        candidates = con.execute("SELECT * FROM books WHERE status='quero_ler'").fetchall()
        if not candidates:
            raise HTTPException(404, "Adicione livros à lista Quero Ler para sortear.")
        book = dict(random.choice(candidates))
        con.execute("INSERT INTO draws(book_id,title,drawn_at) VALUES (?,?,?)", (book['id'], book['title'], datetime.now(timezone.utc).isoformat()))
        return book

@app.get("/history")
def history():
    with connection() as con:
        return [dict(row) for row in con.execute("SELECT * FROM draws ORDER BY id DESC LIMIT 10")]
