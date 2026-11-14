
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

import main
from repository import BookRepository
from schema import metadata


@pytest.fixture
def client_sem_login(tmp_path):
    """Cria um cliente sem autenticação e com banco isolado."""

    test_db = tmp_path / "security_test.db"

    engine = create_engine(
        f"sqlite:///{test_db.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    metadata.create_all(engine)

    def test_repository():
        return BookRepository(engine)

    # Banco exclusivo dos testes de segurança
    main.app.dependency_overrides[
        main.get_repository
    ] = test_repository

    # Não substituímos require_auth:
    # a autenticação real precisa ser verificada.
    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()
        engine.dispose()


def test_health_publico(client_sem_login):
    resposta = client_sem_login.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_biblioteca_bloqueada(client_sem_login):
    resposta = client_sem_login.get("/books")

    assert resposta.status_code == 401


def test_cadastro_bloqueado(client_sem_login):
    resposta = client_sem_login.post(
        "/books",
        json={"title": "O Hobbit"},
    )

    assert resposta.status_code == 401


def test_edicao_bloqueada(client_sem_login):
    resposta = client_sem_login.patch(
        "/books/1",
        json={"title": "Duna"},
    )

    assert resposta.status_code == 401


@pytest.mark.parametrize(
    "rota",
    [
        "/books/1/reading",
        "/books/1/read",
        "/books/1/unread",
    ],
)
def test_alteracao_status_bloqueada(
    client_sem_login,
    rota,
):
    resposta = client_sem_login.patch(rota)

    assert resposta.status_code == 401


def test_exclusao_bloqueada(client_sem_login):
    resposta = client_sem_login.delete("/books/1")

    assert resposta.status_code == 401


def test_sorteio_bloqueado(client_sem_login):
    resposta = client_sem_login.post("/draw")

    assert resposta.status_code == 401


def test_decisao_sorteio_bloqueada(client_sem_login):
    resposta = client_sem_login.post(
        "/draw/1/decision",
        json={"decision": "vou_ler"},
    )

    assert resposta.status_code == 401


def test_historico_bloqueado(client_sem_login):
    resposta = client_sem_login.get("/history")

    assert resposta.status_code == 401


def test_sessao_sem_login_bloqueada(client_sem_login):
    resposta = client_sem_login.get("/auth/me")

    assert resposta.status_code == 401
