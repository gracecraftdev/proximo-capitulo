
import hashlib
import hmac
import os
import secrets

from fastapi import HTTPException, Request, status
from itsdangerous import (
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)


SESSION_COOKIE = "proximo_capitulo_session"
SESSION_MAX_AGE = 60 * 60 * 8
PASSWORD_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Gera um hash PBKDF2 com salt aleatório."""
    salt = secrets.token_bytes(16)

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )

    return (
        f"pbkdf2_sha256${PASSWORD_ITERATIONS}$"
        f"{salt.hex()}${derived_key.hex()}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifica uma senha sem comparar valores diretamente."""
    try:
        algorithm, iterations, salt, expected = (
            stored_hash.split("$")
        )

        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations)

        if iterations < 100_000 or iterations > 2_000_000:
            return False

        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            iterations,
        )

        return hmac.compare_digest(
            derived_key,
            bytes.fromhex(expected),
        )

    except (ValueError, TypeError):
        return False


def get_serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("SESSION_SECRET", "")

    if len(secret) < 32:
        raise RuntimeError(
            "SESSION_SECRET deve ter pelo menos 32 caracteres."
        )

    return URLSafeTimedSerializer(
        secret,
        salt="proximo-capitulo-auth-v1",
    )


def create_session() -> str:
    """Cria um token de sessão assinado."""
    return get_serializer().dumps(
        {"sub": "admin"}
    )


def validate_session(token: str) -> bool:
    """Valida assinatura e prazo da sessão."""
    try:
        payload = get_serializer().loads(
            token,
            max_age=SESSION_MAX_AGE,
        )

        return payload.get("sub") == "admin"

    except (BadSignature, SignatureExpired):
        return False


def require_auth(request: Request) -> str:
    """Bloqueia requisições sem sessão válida."""
    token = request.cookies.get(SESSION_COOKIE)

    if not token or not validate_session(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
        )

    return "admin"
