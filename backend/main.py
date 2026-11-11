
from datetime import datetime, timezone
from functools import lru_cache
import os
import random
import re
import unicodedata

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from database import create_database_engine
from repository import BookRepository
from schema import metadata


# ==========================================
# CONFIGURAÇÕES
# ==========================================

app = FastAPI(
    title="Próximo Capítulo API",
    version="0.3.0",
)

local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

if frontend_url:
    local_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=local_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# CONEXÃO E REPOSITÓRIO
# ==========================================

@lru_cache(maxsize=1)
def get_engine():
    engine = create_database_engine()
    metadata.create_all(engine)
    return engine


def get_repository() -> BookRepository:
    return BookRepository(get_engine())


def normalize(title: str) -> str:
    value = unicodedata.normalize("NFKD", title.casefold())

    value = "".join(
        char for char in value
        if not unicodedata.combining(char)
    )

    return re.sub(r"[^a-z0-9]", "", value)


class BookInput(BaseModel):
    title: str = Field(min_length=1, max_length=250)


# ==========================================
# SAÚDE DA API
# ==========================================

@app.get("/health")
def health():
    return {"status": "ok"}


# ==========================================
# LISTAR LIVROS
# ==========================================

@app.get("/books")
def list_books(repo: BookRepository = Depends(get_repository)):
    return repo.list_books()


# ==========================================
# CADASTRAR LIVRO
# ==========================================

@app.post("/books", status_code=201)
def add_book(
    book: BookInput,
    repo: BookRepository = Depends(get_repository),
):
    title = book.title.strip()
    key = normalize(title)

    if not key:
        raise HTTPException(
            status_code=422,
            detail="Informe um título válido.",
        )

    existing = repo.find_by_normalized_title(key)

    if existing:
        place = (
            "Quero Ler"
            if existing["status"] == "quero_ler"
            else "Já Li"
        )

        raise HTTPException(
            status_code=409,
            detail=f"Livro já cadastrado na lista {place}.",
        )

    try:
        return repo.add_book(title, key)
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Livro já cadastrado.",
        ) from None


# ==========================================
# EDITAR LIVRO
# ==========================================

@app.patch("/books/{book_id}")
def edit_book(
    book_id: int,
    book: BookInput,
    repo: BookRepository = Depends(get_repository),
):
    title = book.title.strip()
    key = normalize(title)

    if not key:
        raise HTTPException(
            status_code=422,
            detail="Informe um título válido.",
        )

    existing = repo.get_book(book_id)

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Livro não encontrado.",
        )

    duplicate = repo.find_by_normalized_title(key)

    if duplicate and duplicate["id"] != book_id:
        raise HTTPException(
            status_code=409,
            detail="Já existe outro livro com esse título.",
        )

    try:
        return repo.update_book(
            book_id,
            title=title,
            normalized_title=key,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Já existe outro livro com esse título.",
        ) from None


# ==========================================
# MARCAR COMO LIDO
# ==========================================

@app.patch("/books/{book_id}/read")
def mark_read(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    updated = repo.update_book(
        book_id,
        status="ja_li",
        read_at=datetime.now(timezone.utc).isoformat(),
    )

    if updated is None:
        raise HTTPException(404, "Livro não encontrado")

    return updated


# ==========================================
# DEVOLVER PARA QUERO LER
# ==========================================

@app.patch("/books/{book_id}/unread")
def mark_unread(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    updated = repo.update_book(
        book_id,
        status="quero_ler",
        read_at=None,
    )

    if updated is None:
        raise HTTPException(404, "Livro não encontrado")

    return updated


# ==========================================
# EXCLUIR LIVRO
# ==========================================

@app.delete("/books/{book_id}", status_code=204)
def delete_book(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    if not repo.delete_book(book_id):
        raise HTTPException(404, "Livro não encontrado")


# ==========================================
# SORTEAR LIVRO
# ==========================================

@app.post("/draw")
def draw(repo: BookRepository = Depends(get_repository)):
    candidates = repo.list_pending_books()

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="Adicione livros à lista Quero Ler para sortear.",
        )

    book = random.choice(candidates)

    repo.add_draw(
        book_id=book["id"],
        title=book["title"],
        drawn_at=datetime.now(timezone.utc).isoformat(),
    )

    return book


# ==========================================
# HISTÓRICO
# ==========================================

@app.get("/history")
def history(repo: BookRepository = Depends(get_repository)):
    return repo.get_history(limit=10)
