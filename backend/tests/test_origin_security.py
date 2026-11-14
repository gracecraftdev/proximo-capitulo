
import pytest

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from origin_security import require_trusted_origin


@pytest.fixture
def client():
    app = FastAPI()

    @app.post(
        "/protected",
        dependencies=[Depends(require_trusted_origin)],
    )
    def protected():
        return {"ok": True}

    @app.get(
        "/protected",
        dependencies=[Depends(require_trusted_origin)],
    )
    def read_protected():
        return {"ok": True}

    return TestClient(app)


def test_origin_permitida_em_producao(
    client,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "FRONTEND_URL",
        "https://proximo-capitulo-nine.vercel.app",
    )

    resposta = client.post(
        "/protected",
        headers={
            "Origin": (
                "https://proximo-capitulo-nine.vercel.app"
            )
        },
    )

    assert resposta.status_code == 200


def test_origin_desconhecida_bloqueada(
    client,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "FRONTEND_URL",
        "https://proximo-capitulo-nine.vercel.app",
    )

    resposta = client.post(
        "/protected",
        headers={
            "Origin": "https://site-desconhecido.com"
        },
    )

    assert resposta.status_code == 403


def test_origin_ausente_bloqueada(
    client,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "FRONTEND_URL",
        "https://proximo-capitulo-nine.vercel.app",
    )

    resposta = client.post("/protected")

    assert resposta.status_code == 403


def test_requisicao_get_permitida(
    client,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "FRONTEND_URL",
        "https://proximo-capitulo-nine.vercel.app",
    )

    resposta = client.get("/protected")

    assert resposta.status_code == 200


def test_ambiente_local_permitido(
    client,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENV", "development")

    resposta = client.post("/protected")

    assert resposta.status_code == 200
