
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


# Banco SQLite utilizado no desenvolvimento local
SQLITE_DB = Path(__file__).with_name("books.db")


def get_database_url() -> str:
    """
    Retorna a URL do banco de dados.

    Desenvolvimento: SQLite.
    Produção: PostgreSQL via DATABASE_URL.
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://",
                "postgresql://",
                1,
            )

        if database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1,
            )

        if not database_url.startswith(
            "postgresql+psycopg://"
        ):
            raise ValueError(
                "DATABASE_URL deve utilizar PostgreSQL."
            )

        return database_url

    return f"sqlite:///{SQLITE_DB.as_posix()}"


def create_database_engine() -> Engine:
    """
    Cria o mecanismo de conexão do SQLAlchemy.
    """
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
