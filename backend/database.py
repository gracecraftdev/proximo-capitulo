import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


# Banco SQLite utilizado somente no desenvolvimento local.
SQLITE_DB = Path(__file__).with_name("books.db")


def get_database_url() -> str:
    """Retorna a conexao do banco sem permitir SQLite em producao."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    production = os.getenv("APP_ENV", "").strip().lower() == "production"

    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://", "postgresql://", 1
            )

        if database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )

        if not database_url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL deve utilizar PostgreSQL.")

        return database_url

    if production:
        raise RuntimeError(
            "DATABASE_URL e obrigatoria em producao. "
            "Configure a URL PostgreSQL do Neon na Vercel."
        )

    return f"sqlite:///{SQLITE_DB.as_posix()}"


def create_database_engine() -> Engine:
    """Cria o mecanismo de conexao SQLAlchemy."""
    database_url = get_database_url()

    if database_url.startswith("sqlite:"):
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
        )

    return create_engine(
        database_url,
        pool_pre_ping=True,
    )
