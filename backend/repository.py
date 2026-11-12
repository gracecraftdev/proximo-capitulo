
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, insert, update, delete
from sqlalchemy.engine import Engine

from schema import books, draws


class BookRepository:
    """Persistência de livros e sorteios (SQLite e PostgreSQL)."""

    def __init__(self, engine: Engine):
        self.engine = engine

    # ==========================================
    # LIVROS
    # ==========================================

    def list_books(self):
        with self.engine.connect() as conn:
            return [
                dict(row)
                for row in conn.execute(
                    select(books).order_by(books.c.title)
                ).mappings()
            ]

    def get_book(self, book_id: int):
        with self.engine.connect() as conn:
            row = conn.execute(
                select(books).where(books.c.id == book_id)
            ).mappings().first()

            return dict(row) if row else None

    def find_by_normalized_title(self, normalized_title: str):
        with self.engine.connect() as conn:
            row = conn.execute(
                select(books).where(
                    books.c.normalized_title == normalized_title
                )
            ).mappings().first()

            return dict(row) if row else None

    def add_book(self, title: str, normalized_title: str):
        with self.engine.begin() as conn:
            book_id = conn.execute(
                insert(books)
                .values(
                    title=title,
                    normalized_title=normalized_title,
                    status="quero_ler",
                )
                .returning(books.c.id)
            ).scalar_one()

            row = conn.execute(
                select(books).where(books.c.id == book_id)
            ).mappings().one()

            return dict(row)

    def update_book(self, book_id: int, **values):
        with self.engine.begin() as conn:
            result = conn.execute(
                update(books)
                .where(books.c.id == book_id)
                .values(**values)
            )

            if result.rowcount == 0:
                return None

            row = conn.execute(
                select(books).where(books.c.id == book_id)
            ).mappings().first()

            return dict(row) if row else None

    def delete_book(self, book_id: int):
        with self.engine.begin() as conn:
            result = conn.execute(
                delete(books).where(books.c.id == book_id)
            )

            return result.rowcount > 0

    def list_pending_books(self):
        """Retorna somente os livros disponíveis para sorteio."""
        with self.engine.connect() as conn:
            return [
                dict(row)
                for row in conn.execute(
                    select(books).where(
                        books.c.status == "quero_ler"
                    )
                ).mappings()
            ]

    # ==========================================
    # SORTEIOS
    # ==========================================

    def add_draw(self, book_id: int, title: str, drawn_at: str):
        """Registra um sorteio ainda sem decisão."""
        with self.engine.begin() as conn:
            result = conn.execute(
                insert(draws)
                .values(
                    book_id=book_id,
                    title=title,
                    drawn_at=drawn_at,
                    decision=None,
                )
                .returning(draws.c.id)
            )

            return result.scalar_one()

    def decide_draw(self, draw_id: int, decision: str):
        """
        Registra a decisão sobre um sorteio.

        vou_ler:
            Move o livro para Lendo.

        agora_nao:
            Mantém o livro em Quero ler.

        Uma decisão já registrada não pode ser repetida.
        """

        with self.engine.begin() as conn:
            record = conn.execute(
                select(draws).where(draws.c.id == draw_id)
            ).mappings().first()

            if record is None:
                return "missing", None

            if record["decision"] is not None:
                return "already_decided", None

            book = conn.execute(
                select(books).where(
                    books.c.id == record["book_id"]
                )
            ).mappings().first()

            if book is None:
                return "book_deleted", None

            if book["status"] != "quero_ler":
                return "status_changed", None

            if decision == "vou_ler":
                conn.execute(
                    update(books)
                    .where(books.c.id == record["book_id"])
                    .values(
                        status="lendo",
                        read_at=None,
                    )
                )

            result = conn.execute(
                update(draws)
                .where(
                    draws.c.id == draw_id,
                    draws.c.decision.is_(None),
                )
                .values(decision=decision)
            )

            if result.rowcount != 1:
                return "already_decided", None

            updated = conn.execute(
                select(books).where(
                    books.c.id == record["book_id"]
                )
            ).mappings().one()

            return "ok", dict(updated)

    # ==========================================
    # HISTÓRICO DE SORTEIOS
    # ==========================================

    def get_history(self, limit: int = 1000, days: int = 30):
        """
        Consulta os sorteios dos últimos 30 dias.

        Os registros mais antigos não são excluídos
        automaticamente do banco de dados.
        """

        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=days)
        ).isoformat()

        with self.engine.connect() as conn:
            result = conn.execute(
                select(draws)
                .where(draws.c.drawn_at >= cutoff)
                .order_by(
                    draws.c.drawn_at.desc(),
                    draws.c.id.desc(),
                )
                .limit(limit)
            )

            return [
                dict(row)
                for row in result.mappings()
            ]
