import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, database, auth

router = APIRouter(prefix="/words", tags=["Words"])


# =========================
# SPELLING CHECK (LanguageTool)
# =========================
def check_spelling(text: str, language_code: str):

    if not text:
        return []

    url = "https://api.languagetool.org/v2/check"

    try:
        response = requests.post(
            url,
            data={
                "text": f"This is {text}",
                "language": language_code
            },
            timeout=3
        )

        if response.status_code != 200:
            return []

        data = response.json()
        return data.get("matches", [])

    except Exception:
        return []


# =========================
# REAL WORD CHECK (Dictionary API)
# =========================
def validate_word_exists(word: str, language_code: str):

    if not word:
        return False

    word = word.lower().strip()

    try:

        # =====================
        # ENGLISH
        # =====================
        if language_code == "en":

            r = requests.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
                timeout=3
            )

            return r.status_code == 200

        # =====================
        # SPANISH
        # =====================
        if language_code == "es":

            r = requests.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/es/{word}",
                timeout=3
            )

            return r.status_code == 200

        # =====================
        # GERMAN
        # =====================
        if language_code == "de":

            r = requests.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/de/{word}",
                timeout=3
            )

            return r.status_code == 200

        # =====================
        # RUSSIAN
        # =====================
        if language_code == "ru":

            r = requests.get(
                f"https://ru.wiktionary.org/wiki/{word}",
                timeout=3
            )

            return "Русский" in r.text

        # =====================
        # POLISH
        # =====================
        if language_code == "pl":

            r = requests.get(
                f"https://pl.wiktionary.org/wiki/{word}",
                timeout=3
            )

            return "język polski" in r.text

    except Exception:
        return False

    return False


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

    # =========================
    # DUPLICATE CHECK
    # =========================

    existing_word = db.query(models.Word).filter(
        models.Word.language_id == word.language_id,
        models.Word.word == word.word
    ).first()

    if existing_word:
        raise HTTPException(
            status_code=400,
            detail="Word already exists in this language"
        )

    language_code = language.code

    # =========================
    # WORD VALIDATION
    # =========================

    is_valid_word = validate_word_exists(word.word.strip(), language_code)

    if not is_valid_word:
        raise HTTPException(
            status_code=400,
            detail="This word does not seem to exist or is misspelled"
        )

    # =========================
    # EXAMPLE SPELL CHECK
    # =========================

    matches_example = check_spelling(word.example or "", language_code)

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