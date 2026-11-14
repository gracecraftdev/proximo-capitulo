
import pytest

from auth import (
    create_session,
    hash_password,
    validate_session,
    verify_password,
)


def test_password_hash():
    password = "MinhaSenhaDeTeste123!"

    stored_hash = hash_password(password)

    assert stored_hash != password
    assert verify_password(password, stored_hash)
    assert not verify_password("SenhaErrada", stored_hash)


def test_password_uses_random_salt():
    password = "MinhaSenhaDeTeste123!"

    first_hash = hash_password(password)
    second_hash = hash_password(password)

    assert first_hash != second_hash


def test_valid_session(monkeypatch):
    monkeypatch.setenv(
        "SESSION_SECRET",
        "segredo-de-teste-com-mais-de-32-caracteres",
    )

    token = create_session()

    assert validate_session(token)


def test_invalid_session(monkeypatch):
    monkeypatch.setenv(
        "SESSION_SECRET",
        "segredo-de-teste-com-mais-de-32-caracteres",
    )

    assert not validate_session("token-invalido")


def test_missing_session_secret(monkeypatch):
    monkeypatch.delenv("SESSION_SECRET", raising=False)

    with pytest.raises(RuntimeError):
        create_session()
