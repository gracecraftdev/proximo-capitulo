
import pytest

from fastapi.testclient import TestClient

import main


FRONTEND_URL = (
    "https://proximo-capitulo-nine.vercel.app"
)


@pytest.fixture
def client_production(monkeypatch):
    """
    Simula a API em produção.

    Não utiliza credenciais reais nem conecta
    ao PostgreSQL do Neon.
    """

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("FRONTEND_URL", FRONTEND_URL)

    main.app.dependency_overrides.clear()

    with TestClient(main.app) as client:
        yield client

    main.app.dependency_overrides.clear()


def test_health_continua_publico(client_production):
    resposta = client_production.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_post_sem_origin_bloqueado(client_production):
    resposta = client_production.post(
        "/books",
        json={"title": "O Hobbit"},
    )

    assert resposta.status_code == 403


def test_post_origin_desconhecida_bloqueado(
    client_production,
):
    resposta = client_production.post(
        "/books",
        json={"title": "O Hobbit"},
        headers={
            "Origin": "https://site-desconhecido.com",
        },
    )

    assert resposta.status_code == 403


def test_origin_permitida_nao_ignora_login(
    client_production,
):
    resposta = client_production.post(
        "/books",
        json={"title": "O Hobbit"},
        headers={
            "Origin": FRONTEND_URL,
        },
    )

    # A origem está autorizada, mas não há login.
    assert resposta.status_code == 401


def test_get_biblioteca_exige_login(
    client_production,
):
    resposta = client_production.get("/books")

    assert resposta.status_code == 401


def test_login_origin_desconhecida_bloqueado(
    client_production,
):
    resposta = client_production.post(
        "/auth/login",
        json={"password": "SenhaFicticia"},
        headers={
            "Origin": "https://site-desconhecido.com",
        },
    )

    assert resposta.status_code == 403


def test_logout_origin_desconhecida_bloqueado(
    client_production,
):
    resposta = client_production.post(
        "/auth/logout",
        headers={
            "Origin": "https://site-desconhecido.com",
        },
    )

    assert resposta.status_code == 403
