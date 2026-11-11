
from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    Table,
    Text,
    text,
)

# Definição das tabelas do banco
metadata = MetaData()


# ==========================================
# TABELA DE LIVROS
# ==========================================

books = Table(
    "books",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("title", Text, nullable=False),
    Column("normalized_title", Text, nullable=False, unique=True),
    Column(
        "status",
        Text,
        nullable=False,
        server_default=text("'quero_ler'"),
    ),
    Column("read_at", Text, nullable=True),
)


# ==========================================
# TABELA DE SORTEIOS
# ==========================================

draws = Table(
    "draws",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("book_id", Integer, nullable=False),
    Column("title", Text, nullable=False),
    Column("drawn_at", Text, nullable=False),
)
