from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from sqlalchemy.orm import Session
from .. import models, schemas, database, auth

router = APIRouter(prefix="/users", tags=["Users"])


# =========================
# REGISTER (AUTO LOGIN + SAVE NATIVE LANGUAGE)
# =========================
@router.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):

    db_user = db.query(models.User).filter(
        models.User.email == user.email
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
        email=user.email,
        password_hash=hashed_password,
        native_language_id=user.native_language_id  # 🔥 СОХРАНЯЕМ
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 🔥 СРАЗУ создаём токен
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

    db_user = db.query(models.User).filter(
        models.User.email == form_data.username
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


# =========================
# CURRENT USER
# =========================
@router.get("/me")
def read_users_me(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    today = datetime.utcnow().date()

    #if it's first entrance
    if not current_user.last_study_date:
        current_user.last_study_date = str(today)
        current_user.streak = 1

    else:
        last_date = datetime.strptime(
            current_user.last_study_date, "%Y-%m-%d"
        ).date()

        diff_days = (today - last_date).days

        if diff_days == 0:
            pass

        elif diff_days == 1:
            #the next day
            current_user.streak += 1
            current_user.last_study_date = str(today)

            #BONUS EVERY 7 DAYS
            if current_user.streak > 0 and current_user.streak % 7 == 0:
                current_user.freeze_days += 1
                current_user.xp += 50
            
            #LEVEL UP LOGIC
            xp_needed = int(100 * (current_user.level ** 1.5))

            while current_user.xp >= xp_needed:
                current_user.xp -= xp_needed
                current_user.level += 1
                xp_needed = int(100 * (current_user.level ** 1.5))

        elif diff_days > 1:
            #if the day off
            if current_user.freeze_days > 0:
                current_user.freeze_days -= 1
                current_user.last_study_date = str(today)
            else:
                current_user.streak = 1
                current_user.last_study_date = str(today)

    db.commit()
    db.refresh(current_user)

    return {
        "email": current_user.email,
        "level": current_user.level,
        "xp": current_user.xp,
        "streak": current_user.streak,
        "freeze_days": current_user.freeze_days,
        "active_language_id": current_user.active_language_id,
        "active_language_name": current_user.active_language.name if current_user.active_language else None,
        "native_language_id": current_user.native_language_id,
        "native_language_name": current_user.native_language.name if current_user.native_language else None
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

    # проверить есть ли уже язык у пользователя
    user_lang = db.query(models.UserLanguage).filter(
        models.UserLanguage.user_id == current_user.id,
        models.UserLanguage.language_id == language_id
    ).first()

    # если нет — добавить
    if not user_lang:
        user_lang = models.UserLanguage(
            user_id=current_user.id,
            language_id=language_id
        )
        db.add(user_lang)

    # установить активный язык
    current_user.active_language_id = language_id

    db.commit()

    return {"message": "Language updated"}