
import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth import SESSION_COOKIE, hash_password
from auth_routes import router


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv(
        "SESSION_SECRET",
        "segredo-exclusivo-para-testes-com-mais-de-32-caracteres",
    )

    monkeypatch.setenv(
        "ADMIN_PASSWORD_HASH",
        hash_password("SenhaDeTeste123!"),
    )

    monkeypatch.setenv("APP_ENV", "development")

    app = FastAPI()
    app.include_router(router)

    with TestClient(app) as test_client:
        yield test_client


def test_login_sucesso(client):
    response = client.post(
        "/auth/login",
        json={"password": "SenhaDeTeste123!"},
    )

    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert SESSION_COOKIE in client.cookies


def test_login_senha_incorreta(client):
    response = client.post(
        "/auth/login",
        json={"password": "SenhaIncorreta"},
    )

    assert response.status_code == 401
    assert SESSION_COOKIE not in client.cookies


def test_consulta_sem_login(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_consulta_com_login(client):
    client.post(
        "/auth/login",
        json={"password": "SenhaDeTeste123!"},
    )

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["user"] == "admin"


def test_logout(client):
    client.post(
        "/auth/login",
        json={"password": "SenhaDeTeste123!"},
    )

    response = client.post("/auth/logout")

    assert response.status_code == 200
    assert SESSION_COOKIE not in client.cookies
    assert client.get("/auth/me").status_code == 401
