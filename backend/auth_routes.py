
import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    create_session,
    require_auth,
    verify_password,
)


# ==========================================
# ROTAS DE AUTENTICAÇÃO
# ==========================================

router = APIRouter(
    prefix="/auth",
    tags=["Autenticação"],
)


# ==========================================
# DADOS DE LOGIN
# ==========================================

class LoginInput(BaseModel):
    email: str = Field(
        min_length=3,
        max_length=254,
    )

    password: str = Field(
        min_length=1,
        max_length=1024,
    )


# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================

def normalize_email(email: str) -> str:
    """
    Remove espaços externos e padroniza
    maiúsculas e minúsculas.
    """
    return email.strip().casefold()


def get_admin_credentials():
    """
    Obtém as credenciais protegidas
    das variáveis de ambiente.

    Nenhuma senha ou e-mail é definido
    diretamente no código.
    """

    admin_email = normalize_email(
        os.getenv("ADMIN_EMAIL", "")
    )

    password_hash = os.getenv(
        "ADMIN_PASSWORD_HASH",
        "",
    )

    if not admin_email or not password_hash:
        raise RuntimeError(
            "ADMIN_EMAIL e ADMIN_PASSWORD_HASH "
            "devem estar configurados."
        )

    return admin_email, password_hash


# ==========================================
# LOGIN
# ==========================================

@router.post("/login")
def login(
    credentials: LoginInput,
    response: Response,
):
    admin_email, stored_hash = get_admin_credentials()

    provided_email = normalize_email(
        credentials.email
    )

    # Verifica e-mail e senha.
    # A mensagem de erro é a mesma para ambos,
    # evitando revelar qual dado está incorreto.

    valid_email = hmac.compare_digest(
        provided_email.encode("utf-8"),
        admin_email.encode("utf-8"),
    )

    valid_password = verify_password(
        credentials.password,
        stored_hash,
    )

    if not (valid_email and valid_password):
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas.",
        )

    # Cria a sessão autenticada.

    token = create_session()

    production = (
        os.getenv("APP_ENV") == "production"
    )

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=production,
        samesite="lax",
        path="/",
    )

    return {
        "authenticated": True,
    }


# ==========================================
# VERIFICAR SESSÃO
# ==========================================

@router.get("/me")
def current_user(
    user: str = Depends(require_auth),
):
    return {
        "authenticated": True,
        "user": user,
    }


# ==========================================
# LOGOUT
# ==========================================

@router.post("/logout")
def logout(response: Response):
    production = (
        os.getenv("APP_ENV") == "production"
    )

    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="lax",
        secure=production,
        httponly=True,
    )

    return {
        "authenticated": False,
    }
