
from sqlalchemy import select, insert, update, delete
from sqlalchemy.engine import Engine

from schema import books, draws


class BookRepository:
    """
    Gerencia o acesso aos dados utilizando SQLAlchemy.

    Compatível com SQLite e PostgreSQL.
    """

    def __init__(self, engine: Engine):
        self.engine = engine

    # ======================================
    # LIVROS
    # ======================================

    def list_books(self):
        with self.engine.connect() as conn:
            result = conn.execute(
                select(books).order_by(books.c.title)
            )

            return [
                dict(row)
                for row in result.mappings()
            ]

    def get_book(self, book_id: int):
        with self.engine.connect() as conn:
            result = conn.execute(
                select(books).where(
                    books.c.id == book_id
                )
            )

            row = result.mappings().first()
            return dict(row) if row else None

    def find_by_normalized_title(self, normalized_title: str):
        with self.engine.connect() as conn:
            result = conn.execute(
                select(books).where(
                    books.c.normalized_title == normalized_title
                )
            )

            row = result.mappings().first()
            return dict(row) if row else None

    def add_book(self, title: str, normalized_title: str):
        with self.engine.begin() as conn:
            result = conn.execute(
                insert(books)
                .values(
                    title=title,
                    normalized_title=normalized_title,
                    status="quero_ler",
                )
                .returning(books.c.id)
            )

            book_id = result.scalar_one()

            row = conn.execute(
                select(books).where(
                    books.c.id == book_id
                )
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
                select(books).where(
                    books.c.id == book_id
                )
            ).mappings().first()

            return dict(row) if row else None

    def delete_book(self, book_id: int):
        with self.engine.begin() as conn:
            result = conn.execute(
                delete(books).where(
                    books.c.id == book_id
                )
            )

            return result.rowcount > 0

    # ======================================
    # SORTEIOS
    # ======================================

    def list_pending_books(self):
        with self.engine.connect() as conn:
            result = conn.execute(
                select(books).where(
                    books.c.status == "quero_ler"
                )
            )

            return [
                dict(row)
                for row in result.mappings()
            ]

    def add_draw(self, book_id: int, title: str, drawn_at: str):
        with self.engine.begin() as conn:
            conn.execute(
                insert(draws).values(
                    book_id=book_id,
                    title=title,
                    drawn_at=drawn_at,
                )
            )

    def get_history(self, limit: int = 10):
        with self.engine.connect() as conn:
            result = conn.execute(
                select(draws)
                .order_by(draws.c.id.desc())
                .limit(limit)
            )

            return [
                dict(row)
                for row in result.mappings()
            ]
