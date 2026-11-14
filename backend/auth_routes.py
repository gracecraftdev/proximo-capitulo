
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


router = APIRouter(prefix="/auth", tags=["Autenticação"])


class LoginInput(BaseModel):
    password: str = Field(min_length=1)


@router.post("/login")
def login(credentials: LoginInput, response: Response):
    stored_hash = os.getenv("ADMIN_PASSWORD_HASH", "")

    if not stored_hash:
        raise RuntimeError(
            "ADMIN_PASSWORD_HASH não configurado."
        )

    if not verify_password(credentials.password, stored_hash):
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas.",
        )

    token = create_session()

    production = os.getenv("APP_ENV") == "production"

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=production,
        samesite="lax",
        path="/",
    )

    return {"authenticated": True}


@router.get("/me")
def current_user(user: str = Depends(require_auth)):
    return {
        "authenticated": True,
        "user": user,
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="lax",
        secure=os.getenv("APP_ENV") == "production",
        httponly=True,
    )

    return {"authenticated": False}
