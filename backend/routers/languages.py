from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, database, auth

router = APIRouter(prefix="/languages", tags=["Languages"])


# =========================
# GET ALL AVAILABLE LANGUAGES (GLOBAL LIST)
# =========================
@router.get("/available")
def get_available_languages(db: Session = Depends(database.get_db)):
    return db.query(models.Language).all()


# =========================
# ADD LANGUAGE TO USER
# =========================
@router.post("/add/{language_id}")
def add_language_to_user(
    language_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    language = db.query(models.Language).filter(
        models.Language.id == language_id
    ).first()

    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    existing = db.query(models.UserLanguage).filter(
        models.UserLanguage.user_id == current_user.id,
        models.UserLanguage.language_id == language_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Language already added")

    user_language = models.UserLanguage(
        user_id=current_user.id,
        language_id=language_id
    )

    db.add(user_language)
    db.commit()

    return {"message": "Language added successfully"}


# =========================
# GET USER LANGUAGES
# =========================
@router.get("/")
def get_user_languages(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    user_languages = db.query(models.UserLanguage).filter(
        models.UserLanguage.user_id == current_user.id
    ).all()

    return [
        {
            "id": ul.language.id,
            "name": ul.language.name,
            "code": ul.language.code
        }
        for ul in user_languages
    ]