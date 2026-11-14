import pytest

from database import get_database_url


def test_producao_sem_database_url_falha(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_database_url()


def test_desenvolvimento_sem_database_url_usa_sqlite(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert get_database_url().startswith("sqlite:///")


def test_producao_com_postgres_usa_psycopg(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://usuario:senha@host/banco"
    )

    assert get_database_url().startswith("postgresql+psycopg://")


def test_producao_nao_aceita_sqlite(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///books.db")

    with pytest.raises(ValueError, match="PostgreSQL"):
        get_database_url()
