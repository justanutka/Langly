import os
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from hashlib import sha256
from pathlib import Path
from secrets import compare_digest, token_urlsafe
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from . import database, models

def _load_local_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return

    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


_load_local_env()

SECRET_KEY = os.getenv("LANGLY_JWT_SECRET", "").strip()
if len(SECRET_KEY.encode("utf-8")) < 32:
    raise RuntimeError(
        "Set LANGLY_JWT_SECRET to a randomly generated secret of at least 32 bytes "
        "in the environment or .env."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 180
MAX_SESSION_AGE = timedelta(days=7)
RENEWAL_COOKIE = "langly_renewal"
SESSION_PATH = "/users/session"
PASSWORD_RULE_MESSAGE = "Password must be at least 7 characters long and contain at least one letter and one digit."
EMAIL_RULE_MESSAGE = "Email must contain @."

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def is_email_valid(email: str) -> bool:
    normalized = normalize_email(email)
    if "@" not in normalized:
        return False

    local_part, _, domain_part = normalized.partition("@")
    return bool(local_part and domain_part)


def is_password_strong(password: str) -> bool:
    normalized = str(password or "")
    if len(normalized) < 7:
        return False

    has_letter = any(char.isalpha() for char in normalized)
    has_digit = any(char.isdigit() for char in normalized)
    return has_letter and has_digit


def session_deadline(now: datetime, absolute_until: datetime) -> datetime:
    return min(now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), absolute_until)


def token_response(user: models.User, session: models.AuthSession, now: datetime) -> dict:
    payload = {
        "sub": user.email,
        "sid": session.id,
        "iat": now,
        "exp": session_deadline(now, session.absolute_until),
    }
    return {
        "access_token": jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM),
        "token_type": "bearer",
    }


def start_session(user: models.User, db: Session, request: Request, response: Response) -> dict:
    now = datetime.utcnow()
    absolute_until = now + MAX_SESSION_AGE
    renewal_key = token_urlsafe(32)
    session = models.AuthSession(
        id=token_urlsafe(24),
        user_id=user.id,
        renewal_hash=sha256(renewal_key.encode()).hexdigest(),
        idle_until=session_deadline(now, absolute_until),
        absolute_until=absolute_until,
    )
    db.query(models.AuthSession).filter(models.AuthSession.idle_until <= now).delete()
    db.add(session)
    tokens = token_response(user, session, now)
    db.commit()
    response.set_cookie(
        RENEWAL_COOKIE, renewal_key, max_age=int(MAX_SESSION_AGE.total_seconds()),
        path=SESSION_PATH, httponly=True, secure=request.url.scheme == "https", samesite="strict",
    )
    response.headers["Cache-Control"] = "no-store"
    return tokens


def invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def resolve_login(token: str, db: Session, *, allow_expired: bool = False):
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM],
            options={
                "require_exp": not allow_expired,
                "require_sub": True,
                "verify_exp": not allow_expired,
            },
        )
    except JWTError:
        raise invalid_credentials() from None

    if not isinstance(payload.get("exp"), int):
        raise invalid_credentials()

    user = db.query(models.User).filter(models.User.email == payload["sub"]).first()
    if user is None:
        raise invalid_credentials()

    session_id = payload.get("sid")
    if not isinstance(session_id, str):
        raise invalid_credentials()
    session = db.get(models.AuthSession, session_id)
    now = datetime.utcnow()
    if (session is None or session.user_id != user.id
            or session.idle_until <= now or session.absolute_until <= now):
        raise invalid_credentials()
    return user, session


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
):
    user, _ = resolve_login(token, db)
    return user


def get_renewable_session(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
):
    renewal_key = request.cookies.get(RENEWAL_COOKIE)
    if not renewal_key:
        raise invalid_credentials()
    user, session = resolve_login(token, db, allow_expired=True)
    if not compare_digest(session.renewal_hash, sha256(renewal_key.encode()).hexdigest()):
        raise invalid_credentials()
    return user, session
