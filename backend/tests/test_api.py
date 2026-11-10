
import sqlite3

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Cria um banco temporário e isolado para cada teste."""
    test_db = tmp_path / "test_books.db"
    monkeypatch.setattr(main, "DB", test_db)

    with main.connection() as con:
        con.execute("""
            CREATE TABLE books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                normalized_title TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'quero_ler',
                read_at TEXT
            )
        """)
        con.execute("""
            CREATE TABLE draws (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                drawn_at TEXT NOT NULL
            )
        """)

    with TestClient(main.app) as test_client:
        yield test_client


def cadastrar(client, titulo="O Hobbit"):
    return client.post("/books", json={"title": titulo})


def test_health(client):
    resposta = client.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_lista_inicial_vazia(client):
    resposta = client.get("/books")

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_cadastrar_livro(client):
    resposta = cadastrar(client)

    assert resposta.status_code == 201
    assert resposta.json()["title"] == "O Hobbit"
    assert resposta.json()["status"] == "quero_ler"


def test_listar_livros(client):
    cadastrar(client, "O Hobbit")
    cadastrar(client, "Duna")

    resposta = client.get("/books")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 2


def test_impedir_livro_duplicado(client):
    cadastrar(client, "O Hobbit")

    resposta = cadastrar(client, "o hobbit")

    assert resposta.status_code == 409


def test_impedir_titulo_invalido(client):
    resposta = cadastrar(client, "!!!")

    assert resposta.status_code == 422


def test_editar_livro(client):
    livro = cadastrar(client).json()

    resposta = client.patch(
        f"/books/{livro['id']}",
        json={"title": "O Senhor dos Anéis"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["title"] == "O Senhor dos Anéis"


def test_impedir_edicao_duplicada(client):
    primeiro = cadastrar(client, "O Hobbit").json()
    cadastrar(client, "Duna")

    resposta = client.patch(
        f"/books/{primeiro['id']}",
        json={"title": "Duna"},
    )

    assert resposta.status_code == 409


def test_editar_livro_inexistente(client):
    resposta = client.patch(
        "/books/999",
        json={"title": "Livro inexistente"},
    )

    assert resposta.status_code == 404


def test_marcar_livro_como_lido(client):
    livro = cadastrar(client).json()

    resposta = client.patch(f"/books/{livro['id']}/read")

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ja_li"
    assert resposta.json()["read_at"] is not None


def test_devolver_livro_para_quero_ler(client):
    livro = cadastrar(client).json()
    client.patch(f"/books/{livro['id']}/read")

    resposta = client.patch(f"/books/{livro['id']}/unread")

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "quero_ler"
    assert resposta.json()["read_at"] is None


def test_excluir_livro(client):
    livro = cadastrar(client).json()

    resposta = client.delete(f"/books/{livro['id']}")

    assert resposta.status_code == 204
    assert client.get("/books").json() == []


def test_excluir_livro_inexistente(client):
    resposta = client.delete("/books/999")

    assert resposta.status_code == 404


def test_sortear_livro(client):
    cadastrar(client, "O Hobbit")

    resposta = client.post("/draw")

    assert resposta.status_code == 200
    assert resposta.json()["title"] == "O Hobbit"


def test_sortear_sem_livros(client):
    resposta = client.post("/draw")

    assert resposta.status_code == 404


def test_sortear_apenas_livros_nao_lidos(client):
    lido = cadastrar(client, "O Hobbit").json()
    cadastrar(client, "Duna")
    client.patch(f"/books/{lido['id']}/read")

    resposta = client.post("/draw")

    assert resposta.status_code == 200
    assert resposta.json()["title"] == "Duna"


def test_historico_de_sorteios(client):
    cadastrar(client, "O Hobbit")
    client.post("/draw")

    resposta = client.get("/history")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 1
    assert resposta.json()[0]["title"] == "O Hobbit"
