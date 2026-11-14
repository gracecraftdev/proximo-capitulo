
import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth import SESSION_COOKIE, hash_password
from auth_routes import router


# ==========================================
# CONFIGURAÇÃO DOS TESTES
# ==========================================

TEST_EMAIL = "admin@exemplo.com"
TEST_PASSWORD = "SenhaDeTeste123!"


@pytest.fixture
def client(monkeypatch):
    """
    Cria uma aplicação isolada para testar
    as rotas de autenticação.

    Utiliza credenciais fictícias.
    """

    monkeypatch.setenv(
        "SESSION_SECRET",
        "segredo-exclusivo-para-testes-com-mais-de-32-caracteres",
    )

    monkeypatch.setenv(
        "ADMIN_EMAIL",
        TEST_EMAIL,
    )

    monkeypatch.setenv(
        "ADMIN_PASSWORD_HASH",
        hash_password(TEST_PASSWORD),
    )

    monkeypatch.setenv(
        "APP_ENV",
        "development",
    )

    app = FastAPI()

    app.include_router(router)

    with TestClient(app) as test_client:
        yield test_client


# ==========================================
# LOGIN COM SUCESSO
# ==========================================

def test_login_sucesso(client):
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    assert (
        response.json()["authenticated"]
        is True
    )

    assert SESSION_COOKIE in client.cookies


# ==========================================
# LOGIN COM E-MAIL INCORRETO
# ==========================================

def test_login_email_incorreto(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "outra-pessoa@exemplo.com",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 401
    assert SESSION_COOKIE not in client.cookies


# ==========================================
# LOGIN COM SENHA INCORRETA
# ==========================================

def test_login_senha_incorreta(client):
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": "SenhaIncorreta",
        },
    )

    assert response.status_code == 401
    assert SESSION_COOKIE not in client.cookies


# ==========================================
# E-MAIL SEM DIFERENCIAR MAIÚSCULAS
# ==========================================

def test_login_email_maiusculo(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "ADMIN@EXEMPLO.COM",
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200
    assert SESSION_COOKIE in client.cookies


# ==========================================
# LOGIN SEM E-MAIL
# ==========================================

def test_login_sem_email(client):
    response = client.post(
        "/auth/login",
        json={
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 422
    assert SESSION_COOKIE not in client.cookies


# ==========================================
# CONSULTA SEM AUTENTICAÇÃO
# ==========================================

def test_consulta_sem_login(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


# ==========================================
# CONSULTA COM AUTENTICAÇÃO
# ==========================================

def test_consulta_com_login(client):
    login_response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["user"] == "admin"


# ==========================================
# LOGOUT
# ==========================================

def test_logout(client):
    login_response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert login_response.status_code == 200

    response = client.post("/auth/logout")

    assert response.status_code == 200
    assert SESSION_COOKIE not in client.cookies

    assert (
        client.get("/auth/me").status_code
        == 401
    )


# ==========================================
# COOKIE HTTPONLY
# ==========================================

def test_cookie_httponly(client):
    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    cookie_header = response.headers["set-cookie"]

    assert "httponly" in cookie_header.lower()
    assert "samesite=lax" in cookie_header.lower()


# ==========================================
# COOKIE SECURE EM PRODUÇÃO
# ==========================================

def test_cookie_secure_em_producao(
    client,
    monkeypatch,
):
    monkeypatch.setenv(
        "APP_ENV",
        "production",
    )

    response = client.post(
        "/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )

    assert response.status_code == 200

    cookie_header = response.headers["set-cookie"]

    assert "secure" in cookie_header.lower()
