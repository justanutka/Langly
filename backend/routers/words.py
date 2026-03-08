import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, database, auth

router = APIRouter(prefix="/words", tags=["Words"])


# =========================
# SPELLING CHECK
# =========================
def check_spelling(text: str, language_code: str):

    if not text:
        return []

    url = "https://api.languagetool.org/v2/check"

    try:
        response = requests.post(
            url,
            data={
                "text": text,
                "language": language_code
            },
            timeout=2
        )

        if response.status_code != 200:
            return []

        return response.json().get("matches", [])

    except Exception:
        return []


# =========================
# CREATE WORD
# =========================
@router.post("/")
def create_word(
    word: schemas.WordCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    language = db.query(models.Language).filter(
        models.Language.id == word.language_id
    ).first()

    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    selected_language = db.query(models.UserLanguage).filter(
        models.UserLanguage.user_id == current_user.id,
        models.UserLanguage.language_id == word.language_id
    ).first()

    if not selected_language:
        raise HTTPException(
            status_code=400,
            detail="You have not selected this language"
        )

    # Проверка на дубликат
    existing_word = db.query(models.Word).filter(
        models.Word.language_id == word.language_id,
        models.Word.word == word.word
    ).first()

    if existing_word:
        raise HTTPException(
            status_code=400,
            detail="Word already exists in this language"
        )

    # =========================
    # SPELLING CHECK
    # =========================

    language_code = language.code

    matches_word = check_spelling(word.word, language_code)

    if matches_word:
        suggestions = matches_word[0].get("replacements", [])
        if suggestions:
            suggestion = suggestions[0]["value"]
            raise HTTPException(
                status_code=400,
                detail=f"Spelling mistake in word. Did you mean '{suggestion}'?"
            )

    matches_example = check_spelling(word.example, language_code)

    if matches_example:
        suggestions = matches_example[0].get("replacements", [])
        if suggestions:
            suggestion = suggestions[0]["value"]
            raise HTTPException(
                status_code=400,
                detail=f"Spelling mistake in example. Suggested correction: '{suggestion}'"
            )

    # =========================
    # CREATE WORD
    # =========================

    new_word = models.Word(
        word=word.word,
        translation=word.translation,
        example=word.example,
        language_id=word.language_id,
        module_id=word.module_id
    )

    db.add(new_word)
    db.commit()
    db.refresh(new_word)

    # =========================
    # CREATE REVIEW STATE
    # =========================

    review_state = models.ReviewState(
        word_id=new_word.id,
        repetition=0,
        interval=1,
        ef="2.5",
        next_review=None
    )

    db.add(review_state)
    db.commit()

    return new_word


# =========================
# GET WORDS
# =========================
@router.get("/")
def get_words(
    language_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    language = db.query(models.Language).filter(
        models.Language.id == language_id
    ).first()

    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    selected_language = db.query(models.UserLanguage).filter(
        models.UserLanguage.user_id == current_user.id,
        models.UserLanguage.language_id == language_id
    ).first()

    if not selected_language:
        raise HTTPException(
            status_code=400,
            detail="You have not selected this language"
        )

    return db.query(models.Word).filter(
        models.Word.language_id == language_id
    ).all()