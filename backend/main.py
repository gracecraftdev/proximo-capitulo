
from datetime import datetime, timezone
from functools import lru_cache
from typing import Literal

import os
import random
import re
import unicodedata

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from auth import require_auth
from auth_routes import router as auth_router
from database import create_database_engine
from origin_security import require_trusted_origin
from repository import BookRepository
from schema import metadata


# ==========================================
# CONFIGURAÇÕES DA API
# ==========================================

app = FastAPI(
    title="Próximo Capítulo API",
    version="0.5.0",
)


# ==========================================
# CONFIGURAÇÃO DO CORS
# ==========================================

local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
]

frontend_url = os.getenv(
    "FRONTEND_URL",
    "",
).strip().rstrip("/")

if frontend_url:
    local_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=local_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# PROTEÇÃO DE ORIGEM DAS REQUISIÇÕES
# ==========================================

@app.middleware("http")
async def validate_request_origin(
    request: Request,
    call_next,
):
    """
    Verifica a origem das requisições que podem
    alterar dados ou sessões.

    A validação é aplicada em produção pelo módulo
    origin_security.py.
    """

    try:
        require_trusted_origin(request)

    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
            },
        )

    return await call_next(request)


# ==========================================
# ROTAS DE AUTENTICAÇÃO
# ==========================================

app.include_router(auth_router)


# ==========================================
# CONEXÃO, TABELAS E MIGRAÇÃO
# ==========================================

def migrate_database(engine):
    """
    Atualiza bancos criados por versões anteriores.

    A coluna decision é adicionada somente quando
    ainda não existe.

    Os livros e sorteios existentes são preservados.
    """

    inspector = inspect(engine)

    if "draws" not in inspector.get_table_names():
        return

    columns = {
        column["name"]
        for column in inspector.get_columns("draws")
    }

    if "decision" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE draws "
                    "ADD COLUMN decision TEXT"
                )
            )


@lru_cache(maxsize=1)
def get_engine():
    """
    Cria e reutiliza a conexão com o banco.

    Em desenvolvimento, utiliza SQLite.
    Em produção, utiliza PostgreSQL via DATABASE_URL.
    """

    engine = create_database_engine()

    metadata.create_all(engine)
    migrate_database(engine)

    return engine


def get_repository() -> BookRepository:
    return BookRepository(get_engine())


# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================

def normalize(title: str) -> str:
    """
    Normaliza títulos para impedir duplicidades.
    """

    value = unicodedata.normalize(
        "NFKD",
        title.casefold(),
    )

    value = "".join(
        char
        for char in value
        if not unicodedata.combining(char)
    )

    return re.sub(r"[^a-z0-9]", "", value)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_book(
    repo: BookRepository,
    book_id: int,
):
    """
    Busca um livro ou retorna erro 404.
    """

    book = repo.get_book(book_id)

    if book is None:
        raise HTTPException(
            status_code=404,
            detail="Livro não encontrado.",
        )

    return book


def change_status(
    repo: BookRepository,
    book_id: int,
    status: str,
):
    """
    Atualiza o status de leitura de um livro.
    """

    require_book(repo, book_id)

    read_at = (
        now_utc()
        if status == "ja_li"
        else None
    )

    updated = repo.update_book(
        book_id,
        status=status,
        read_at=read_at,
    )

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Livro não encontrado.",
        )

    return updated


# ==========================================
# MODELOS DE ENTRADA
# ==========================================

class BookInput(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=250,
    )


class DrawDecisionInput(BaseModel):
    decision: Literal[
        "vou_ler",
        "agora_nao",
    ]


# ==========================================
# SAÚDE DA API — ROTA PÚBLICA
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
    }


# ==========================================
# LISTAR LIVROS
# ==========================================

@app.get(
    "/books",
    dependencies=[Depends(require_auth)],
)
def list_books(
    repo: BookRepository = Depends(get_repository),
):
    return repo.list_books()


# ==========================================
# CADASTRAR LIVRO
# ==========================================

@app.post(
    "/books",
    status_code=201,
    dependencies=[Depends(require_auth)],
)
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
        status_names = {
            "quero_ler": "Quero ler",
            "lendo": "Lendo",
            "ja_li": "Já li",
        }

        place = status_names.get(
            existing["status"],
            "Minha biblioteca",
        )

        raise HTTPException(
            status_code=409,
            detail=(
                f"Livro já cadastrado na lista {place}."
            ),
        )

    try:
        return repo.add_book(
            title,
            key,
        )

    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Livro já cadastrado.",
        ) from None


# ==========================================
# EDITAR LIVRO
# ==========================================

@app.patch(
    "/books/{book_id}",
    dependencies=[Depends(require_auth)],
)
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

    require_book(
        repo,
        book_id,
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
# MARCAR LIVRO COMO LENDO
# ==========================================

@app.patch(
    "/books/{book_id}/reading",
    dependencies=[Depends(require_auth)],
)
def mark_reading(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    return change_status(
        repo,
        book_id,
        "lendo",
    )


# ==========================================
# MARCAR LIVRO COMO CONCLUÍDO / JÁ LI
# ==========================================

@app.patch(
    "/books/{book_id}/read",
    dependencies=[Depends(require_auth)],
)
def mark_read(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    return change_status(
        repo,
        book_id,
        "ja_li",
    )


# ==========================================
# DEVOLVER LIVRO PARA QUERO LER
# ==========================================

@app.patch(
    "/books/{book_id}/unread",
    dependencies=[Depends(require_auth)],
)
def mark_unread(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    return change_status(
        repo,
        book_id,
        "quero_ler",
    )


# ==========================================
# EXCLUIR LIVRO
# ==========================================

@app.delete(
    "/books/{book_id}",
    status_code=204,
    dependencies=[Depends(require_auth)],
)
def delete_book(
    book_id: int,
    repo: BookRepository = Depends(get_repository),
):
    if not repo.delete_book(book_id):
        raise HTTPException(
            status_code=404,
            detail="Livro não encontrado.",
        )


# ==========================================
# SORTEAR LIVRO
# ==========================================

@app.post(
    "/draw",
    dependencies=[Depends(require_auth)],
)
def draw(
    repo: BookRepository = Depends(get_repository),
):
    candidates = repo.list_pending_books()

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail=(
                "Não existem livros disponíveis para sorteio. "
                "Adicione livros à lista Quero ler."
            ),
        )

    book = random.choice(candidates)

    draw_id = repo.add_draw(
        book_id=book["id"],
        title=book["title"],
        drawn_at=now_utc(),
    )

    # Mantém os campos originais para compatibilidade
    # com o frontend e identifica o sorteio realizado.

    return {
        **book,
        "draw_id": draw_id,
    }


# ==========================================
# REGISTRAR DECISÃO DO SORTEIO
# ==========================================

@app.post(
    "/draw/{draw_id}/decision",
    dependencies=[Depends(require_auth)],
)
def decide_draw(
    draw_id: int,
    payload: DrawDecisionInput,
    repo: BookRepository = Depends(get_repository),
):
    result, book = repo.decide_draw(
        draw_id,
        payload.decision,
    )

    if result == "missing":
        raise HTTPException(
            status_code=404,
            detail="Sorteio não encontrado.",
        )

    if result == "already_decided":
        raise HTTPException(
            status_code=409,
            detail=(
                "Este sorteio já recebeu uma decisão."
            ),
        )

    if result == "book_deleted":
        raise HTTPException(
            status_code=409,
            detail=(
                "O livro sorteado não está mais "
                "na biblioteca."
            ),
        )

    if result == "status_changed":
        raise HTTPException(
            status_code=409,
            detail=(
                "O livro mudou de lista após o sorteio. "
                "Realize um novo sorteio."
            ),
        )

    if result != "ok" or book is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Não foi possível registrar a decisão."
            ),
        )

    return {
        "draw_id": draw_id,
        "decision": payload.decision,
        "book": book,
    }


# ==========================================
# HISTÓRICO DOS ÚLTIMOS 30 DIAS
# ==========================================

@app.get(
    "/history",
    dependencies=[Depends(require_auth)],
)
def history(
    repo: BookRepository = Depends(get_repository),
):
    return repo.get_history(
        limit=1000,
        days=30,
    )
