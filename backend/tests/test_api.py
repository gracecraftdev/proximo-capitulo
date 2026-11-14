
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, insert, inspect, text

import main
from repository import BookRepository
from schema import draws, metadata


@pytest.fixture
def client(tmp_path):
    """Cria um banco SQLite isolado para cada teste."""
    test_db = tmp_path / "test_books.db"

    engine = create_engine(
        f"sqlite:///{test_db.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    metadata.create_all(engine)

    def test_repository():
        return BookRepository(engine)

    # Utiliza banco de dados isolado durante os testes
    main.app.dependency_overrides[
        main.get_repository
    ] = test_repository

    # Simula um usuário autenticado apenas nestes testes
    main.app.dependency_overrides[
        main.require_auth
    ] = lambda: "admin"

    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()
        engine.dispose()


def cadastrar(client, titulo="O Hobbit"):
    return client.post(
        "/books",
        json={"title": titulo},
    )


# ==========================================
# TESTES ORIGINAIS
# ==========================================

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

    resposta = client.patch(
        f"/books/{livro['id']}/read"
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ja_li"
    assert resposta.json()["read_at"] is not None


def test_devolver_livro_para_quero_ler(client):
    livro = cadastrar(client).json()

    client.patch(
        f"/books/{livro['id']}/read"
    )

    resposta = client.patch(
        f"/books/{livro['id']}/unread"
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "quero_ler"
    assert resposta.json()["read_at"] is None


def test_excluir_livro(client):
    livro = cadastrar(client).json()

    resposta = client.delete(
        f"/books/{livro['id']}"
    )

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
    assert resposta.json()["draw_id"] > 0


def test_sortear_sem_livros(client):
    resposta = client.post("/draw")

    assert resposta.status_code == 404


def test_sortear_apenas_livros_nao_lidos(client):
    lido = cadastrar(client, "O Hobbit").json()
    cadastrar(client, "Duna")

    client.patch(
        f"/books/{lido['id']}/read"
    )

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


# ==========================================
# NOVOS TESTES — LENDO
# ==========================================

def test_marcar_livro_como_lendo(client):
    livro = cadastrar(client, "Duna").json()

    resposta = client.patch(
        f"/books/{livro['id']}/reading"
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "lendo"
    assert resposta.json()["read_at"] is None


def test_lendo_nao_participa_do_sorteio(client):
    livro = cadastrar(client, "Duna").json()

    client.patch(
        f"/books/{livro['id']}/reading"
    )

    resposta = client.post("/draw")

    assert resposta.status_code == 404


def test_fluxo_completo_de_leitura(client):
    livro = cadastrar(client, "Duna").json()

    sorteio = client.post("/draw").json()
    draw_id = sorteio["draw_id"]

    decisao = client.post(
        f"/draw/{draw_id}/decision",
        json={"decision": "vou_ler"},
    )

    assert decisao.status_code == 200
    assert decisao.json()["book"]["status"] == "lendo"

    # Um livro em Lendo não pode ser sorteado.
    assert client.post("/draw").status_code == 404

    concluido = client.patch(
        f"/books/{livro['id']}/read"
    )

    assert concluido.status_code == 200
    assert concluido.json()["status"] == "ja_li"
    assert concluido.json()["read_at"] is not None

    historico = client.get("/history").json()

    assert historico[0]["decision"] == "vou_ler"


# ==========================================
# NOVOS TESTES — DECISÕES DOS SORTEIOS
# ==========================================

def test_agora_nao_mantem_livro_disponivel(client):
    cadastrar(client, "O Hobbit")

    sorteio = client.post("/draw").json()

    resposta = client.post(
        f"/draw/{sorteio['draw_id']}/decision",
        json={"decision": "agora_nao"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["book"]["status"] == "quero_ler"

    # O mesmo livro continua disponível.
    novo_sorteio = client.post("/draw")

    assert novo_sorteio.status_code == 200
    assert novo_sorteio.json()["title"] == "O Hobbit"


def test_impedir_decisao_duplicada_ou_invalida(client):
    cadastrar(client)

    sorteio = client.post("/draw").json()

    caminho = (
        f"/draw/{sorteio['draw_id']}/decision"
    )

    invalida = client.post(
        caminho,
        json={"decision": "invalida"},
    )

    assert invalida.status_code == 422

    primeira = client.post(
        caminho,
        json={"decision": "vou_ler"},
    )

    assert primeira.status_code == 200

    repetida = client.post(
        caminho,
        json={"decision": "agora_nao"},
    )

    assert repetida.status_code == 409

    inexistente = client.post(
        "/draw/999/decision",
        json={"decision": "vou_ler"},
    )

    assert inexistente.status_code == 404


# ==========================================
# NOVO TESTE — HISTÓRICO DE 30 DIAS
# ==========================================

def test_historico_mostra_apenas_30_dias(client):
    cadastrar(client, "O Hobbit")

    client.post("/draw")

    repo = main.app.dependency_overrides[
        main.get_repository
    ]()

    data_antiga = (
        datetime.now(timezone.utc) - timedelta(days=35)
    ).isoformat()

    with repo.engine.begin() as conn:
        conn.execute(
            insert(draws).values(
                book_id=1,
                title="Sorteio antigo",
                drawn_at=data_antiga,
                decision=None,
            )
        )

    resposta = client.get("/history")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 1
    assert resposta.json()[0]["title"] == "O Hobbit"


# ==========================================
# NOVO TESTE — MIGRAÇÃO DO BANCO ANTIGO
# ==========================================

def test_migracao_preserva_historico_antigo(tmp_path, monkeypatch):
    caminho = tmp_path / "old.db"
    url = f"sqlite:///{caminho.as_posix()}"

    engine = create_engine(url)

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE draws ("
                "id INTEGER PRIMARY KEY, "
                "book_id INTEGER NOT NULL, "
                "title TEXT NOT NULL, "
                "drawn_at TEXT NOT NULL)"
            )
        )

        conn.execute(
            text(
                "INSERT INTO draws "
                "(id, book_id, title, drawn_at) "
                "VALUES "
                "(1, 5, 'Livro antigo', "
                "'2026-11-10T10:00:00+00:00')"
            )
        )

    engine.dispose()

    monkeypatch.setattr(
        main,
        "create_database_engine",
        lambda: create_engine(url),
    )

    main.get_engine.cache_clear()

    migrated = None

    try:
        migrated = main.get_engine()

        colunas = {
            column["name"]
            for column in inspect(migrated).get_columns("draws")
        }

        assert "decision" in colunas

        with migrated.connect() as conn:
            titulo = conn.execute(
                text(
                    "SELECT title FROM draws WHERE id = 1"
                )
            ).scalar_one()

        assert titulo == "Livro antigo"

    finally:
        main.get_engine.cache_clear()

        if migrated is not None:
            migrated.dispose()
