
import os

from fastapi import HTTPException, Request


UNSAFE_METHODS = {
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
}


def require_trusted_origin(request: Request) -> None:
    """
    Em produção, aceita alterações apenas da origem
    autorizada do frontend.

    A validação é aplicada aos métodos que podem
    alterar informações ou sessões.
    """

    if request.method not in UNSAFE_METHODS:
        return

    if os.getenv("APP_ENV") != "production":
        return

    allowed_origin = os.getenv(
        "FRONTEND_URL",
        "",
    ).strip().rstrip("/")

    if not allowed_origin:
        raise RuntimeError(
            "FRONTEND_URL não configurada em produção."
        )

    request_origin = request.headers.get("origin", "")

    if request_origin != allowed_origin:
        raise HTTPException(
            status_code=403,
            detail="Origem da requisição não autorizada.",
        )
