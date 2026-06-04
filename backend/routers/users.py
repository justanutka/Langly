import hashlib
import os
import secrets
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models, schemas, database, auth
from ..stats import get_or_create_user_language, xp_needed_for_level

router = APIRouter(prefix="/users", tags=["Users"])

PASSWORD_RESET_CODE_MINUTES = 10
DOTENV_LOADED = False


def load_local_env():
    global DOTENV_LOADED

    if DOTENV_LOADED:
        return

    DOTENV_LOADED = True
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key and key not in os.environ:
                os.environ[key] = value


def hash_reset_code(code: str) -> str:
    return hashlib.sha256(str(code).encode("utf-8")).hexdigest()


def send_password_reset_code(email: str, code: str):
    load_local_env()

    subject = "Langly password reset code"
    body = (
        "Hello,\n\n"
        f"Your Langly password reset confirmation code is: {code}\n\n"
        f"This code expires in {PASSWORD_RESET_CODE_MINUTES} minutes. "
        "If you did not request a password reset, you can ignore this message.\n\n"
        "Langly"
    )

    # SMTP settings belong to the app mailbox that sends the code.
    # The "email" function argument is the recipient typed by the user in the reset form.
    smtp_host = os.getenv("LANGLY_SMTP_HOST")
    smtp_port = int(os.getenv("LANGLY_SMTP_PORT") or "587")
    smtp_user = os.getenv("LANGLY_SMTP_USER")
    smtp_password = os.getenv("LANGLY_SMTP_PASSWORD")
    smtp_from = os.getenv("LANGLY_SMTP_FROM") or smtp_user
    smtp_ssl = (os.getenv("LANGLY_SMTP_SSL") or "").strip().lower() in {"1", "true", "yes"}
    smtp_starttls = (os.getenv("LANGLY_SMTP_STARTTLS") or "true").strip().lower() not in {"0", "false", "no"}

    if not smtp_host or not smtp_from:
        print(f"[Langly password reset] Code for {email}: {code}")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(body)

    smtp_class = smtplib.SMTP_SSL if smtp_ssl else smtplib.SMTP

    with smtp_class(smtp_host, smtp_port) as smtp:
        if not smtp_ssl and smtp_starttls:
            smtp.starttls()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)

    return True


# =========================
# REGISTER (AUTO LOGIN + SAVE NATIVE LANGUAGE)
# =========================
@router.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    normalized_email = auth.normalize_email(user.email)

    if not auth.is_email_valid(normalized_email):
        raise HTTPException(status_code=400, detail=auth.EMAIL_RULE_MESSAGE)

    if not auth.is_password_strong(user.password):
        raise HTTPException(status_code=400, detail=auth.PASSWORD_RULE_MESSAGE)

    db_user = db.query(models.User).filter(
        models.User.email == normalized_email
    ).first()

    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Проверяем, существует ли выбранный родной язык
    native_language = db.query(models.Language).filter(
        models.Language.id == user.native_language_id
    ).first()

    if not native_language:
        raise HTTPException(status_code=400, detail="Invalid native language")

    hashed_password = auth.hash_password(user.password)

    new_user = models.User(
        email=normalized_email,
        password_hash=hashed_password,
        native_language_id=user.native_language_id,
        interface_language_id=user.native_language_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    #make token
    access_token = auth.create_access_token(
        data={"sub": new_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================
# LOGIN
# =========================
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db)
):
    normalized_email = auth.normalize_email(form_data.username)

    db_user = db.query(models.User).filter(
        models.User.email == normalized_email
    ).first()

    if not db_user or not auth.verify_password(
        form_data.password, db_user.password_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = auth.create_access_token(
        data={"sub": db_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/forgot-password")
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(database.get_db)
):
    normalized_email = auth.normalize_email(payload.email)

    if not auth.is_email_valid(normalized_email):
        raise HTTPException(status_code=400, detail=auth.EMAIL_RULE_MESSAGE)

    db.query(models.User).filter(models.User.email == normalized_email).first()

    return {"message": "If this email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(database.get_db)
):
    normalized_email = auth.normalize_email(payload.email)

    if not auth.is_email_valid(normalized_email):
        raise HTTPException(status_code=400, detail=auth.EMAIL_RULE_MESSAGE)

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    if not auth.is_password_strong(payload.new_password):
        raise HTTPException(status_code=400, detail=auth.PASSWORD_RULE_MESSAGE)

    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    if user:
        code = f"{secrets.randbelow(1000000):06d}"
        expires_at = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_CODE_MINUTES)

        db.query(models.PasswordResetCode).filter(
            models.PasswordResetCode.email == normalized_email,
            models.PasswordResetCode.used_at.is_(None)
        ).delete(synchronize_session=False)

        reset_code = models.PasswordResetCode(
            email=normalized_email,
            code_hash=hash_reset_code(code),
            new_password_hash=auth.hash_password(payload.new_password),
            expires_at=expires_at
        )

        db.add(reset_code)
        db.commit()

        try:
            email_sent = send_password_reset_code(normalized_email, code)
        except Exception as error:
            print(f"[Langly password reset] Email send failed for {normalized_email}: {error}")
            print(f"[Langly password reset] Code for {normalized_email}: {code}")
            raise HTTPException(
                status_code=500,
                detail="Could not send the confirmation code. Check SMTP settings."
            )

        if not email_sent:
            raise HTTPException(
                status_code=500,
                detail="Email sending is not configured. Set LANGLY_SMTP_* in .env and restart the backend."
            )

    return {"message": "If this email exists, a confirmation code has been sent."}


@router.post("/reset-password/confirm")
def confirm_reset_password(
    payload: schemas.ResetPasswordConfirmRequest,
    db: Session = Depends(database.get_db)
):
    normalized_email = auth.normalize_email(payload.email)
    code = str(payload.code or "").strip()

    if not auth.is_email_valid(normalized_email):
        raise HTTPException(status_code=400, detail=auth.EMAIL_RULE_MESSAGE)

    if not code:
        raise HTTPException(status_code=400, detail="Enter the confirmation code.")

    reset_code = db.query(models.PasswordResetCode).filter(
        models.PasswordResetCode.email == normalized_email,
        models.PasswordResetCode.used_at.is_(None)
    ).order_by(models.PasswordResetCode.created_at.desc()).first()

    if (
        not reset_code
        or reset_code.expires_at < datetime.utcnow()
        or reset_code.code_hash != hash_reset_code(code)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation code.")

    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation code.")

    user.password_hash = reset_code.new_password_hash
    reset_code.used_at = datetime.utcnow()
    db.commit()

    return {"message": "Password has been reset successfully."}


# =========================
# CURRENT USER
# =========================
@router.get("/me")
def read_users_me(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    today = datetime.utcnow().date()

    if current_user.active_language_id:
        user_language = get_or_create_user_language(
            db, user_id=current_user.id, language_id=current_user.active_language_id
        )

        if not user_language.last_study_date:
            user_language.last_study_date = str(today)
            user_language.streak = 1
        else:
            last_date = datetime.strptime(user_language.last_study_date, "%Y-%m-%d").date()
            diff_days = (today - last_date).days

            if diff_days == 0:
                pass
            elif diff_days == 1:
                user_language.streak += 1
                user_language.last_study_date = str(today)

                if user_language.streak > 0 and user_language.streak % 7 == 0:
                    user_language.freeze_days += 1
                    user_language.xp += 50

                xp_needed = xp_needed_for_level(user_language.level)
                while user_language.xp >= xp_needed:
                    user_language.xp -= xp_needed
                    user_language.level += 1
                    xp_needed = xp_needed_for_level(user_language.level)

            elif diff_days > 1:
                if user_language.freeze_days > 0:
                    user_language.freeze_days -= 1
                    user_language.last_study_date = str(today)
                else:
                    user_language.streak = 1
                    user_language.last_study_date = str(today)

        db.commit()
        db.refresh(current_user)
        db.refresh(user_language)

        level = user_language.level
        xp = user_language.xp
        streak = user_language.streak
        freeze_days = user_language.freeze_days

    else:
        if not current_user.last_study_date:
            current_user.last_study_date = str(today)
            current_user.streak = 1
        else:
            last_date = datetime.strptime(current_user.last_study_date, "%Y-%m-%d").date()
            diff_days = (today - last_date).days

            if diff_days == 0:
                pass
            elif diff_days == 1:
                current_user.streak += 1
                current_user.last_study_date = str(today)

                if current_user.streak > 0 and current_user.streak % 7 == 0:
                    current_user.freeze_days += 1
                    current_user.xp += 50

                xp_needed = xp_needed_for_level(current_user.level)
                while current_user.xp >= xp_needed:
                    current_user.xp -= xp_needed
                    current_user.level += 1
                    xp_needed = xp_needed_for_level(current_user.level)

            elif diff_days > 1:
                if current_user.freeze_days > 0:
                    current_user.freeze_days -= 1
                    current_user.last_study_date = str(today)
                else:
                    current_user.streak = 1
                    current_user.last_study_date = str(today)

        db.commit()
        db.refresh(current_user)

        level = current_user.level
        xp = current_user.xp
        streak = current_user.streak
        freeze_days = current_user.freeze_days

    interface_language = current_user.interface_language or current_user.native_language

    return {
        "email": current_user.email,
        "level": level,
        "xp": xp,
        "streak": streak,
        "freeze_days": freeze_days,
        "active_language_id": current_user.active_language_id,
        "active_language_name": current_user.active_language.name if current_user.active_language else None,
        "active_language_code": current_user.active_language.code if current_user.active_language else None,
        "native_language_id": current_user.native_language_id,
        "native_language_name": current_user.native_language.name if current_user.native_language else None,
        "native_language_code": current_user.native_language.code if current_user.native_language else None,
        "interface_language_id": interface_language.id if interface_language else None,
        "interface_language_name": interface_language.name if interface_language else None,
        "interface_language_code": interface_language.code if interface_language else None
    }


# =========================
# GET LANGUAGES
# =========================
@router.get("/languages")
def get_languages(db: Session = Depends(database.get_db)):
    return db.query(models.Language).all()


# =========================
# SET ACTIVE LANGUAGE
# =========================
@router.post("/set-language")
def set_language(
    language_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    language = db.query(models.Language).filter(
        models.Language.id == language_id
    ).first()

    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    get_or_create_user_language(db, user_id=current_user.id, language_id=language_id)

    current_user.active_language_id = language_id

    db.commit()

    return {"message": "Language updated"}


# =========================
# SET INTERFACE LANGUAGE
# =========================
@router.post("/set-interface-language")
def set_interface_language(
    language_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    language = db.query(models.Language).filter(
        models.Language.id == language_id
    ).first()

    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    current_user.interface_language_id = language_id
    db.commit()

    return {"message": "Interface language updated"}
