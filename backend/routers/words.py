import requests
import re
import unicodedata
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .. import models, schemas, database, auth
from datetime import datetime

router = APIRouter(prefix="/words", tags=["Words"])

WIKTIONARY_USER_AGENT = "Langly/1.0 (https://github.com/justanutka/Langly)"
WIKTIONARY_LANGUAGE_SECTIONS = {
    "de": r"Sprache[ \t]*\|[ \t]*Deutsch",
    "es": r"lengua[ \t]*\|[ \t]*es",
    "pl": r"język[ \t]+polski",
    "ru": r"-ru-",
}


class DictionaryUnavailable(Exception):
    pass


def normalize_entry(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


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


def validate_word_exists(word: str, language_code: str) -> bool:
    word = normalize_entry(word)
    if not word:
        return False

    try:
        if language_code == "en":
            response = requests.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{quote(word.lower(), safe='')}",
                timeout=3,
            )
            if response.status_code == 404:
                return False
            response.raise_for_status()
            entries = response.json()
            if not isinstance(entries, list) or not entries:
                raise DictionaryUnavailable()
            return True

        if language_code in WIKTIONARY_LANGUAGE_SECTIONS:
            return validate_wiktionary_word(word, language_code)
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as error:
        raise DictionaryUnavailable() from error

    return False


def validate_wiktionary_word(word: str, language_code: str) -> bool:
    if re.search(r"[|#<>\[\]{}]", word):
        return False

    lowercase = word.lower()
    titles = [word, lowercase]
    if language_code == "de":
        titles.append(lowercase[0].upper() + lowercase[1:])

    response = requests.get(
        f"https://{language_code}.wiktionary.org/w/api.php",
        params={
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
            "maxlag": 5,
            "titles": "|".join(dict.fromkeys(titles)),
        },
        headers={"User-Agent": WIKTIONARY_USER_AGENT},
        timeout=3,
    )
    response.raise_for_status()
    pages = response.json()["query"]["pages"]
    if not isinstance(pages, list) or not pages:
        raise DictionaryUnavailable()
    language_template = WIKTIONARY_LANGUAGE_SECTIONS[language_code]
    heading = re.compile(
        rf"^={{1,2}}(?![=])[^\r\n]*?\{{\{{[ \t]*{language_template}[ \t]*(?:\||\}}\}})"
        r"[^\r\n]*?={1,2}[ \t]*$",
        re.MULTILINE | re.IGNORECASE,
    )
    for page in pages:
        if page.get("missing") or page.get("invalid") or page["ns"] != 0:
            continue
        content = page["revisions"][0]["slots"]["main"]["content"]
        if heading.search(content):
            return True
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

    module = db.query(models.Module).join(models.Folder).filter(
        models.Module.id == word.module_id,
        models.Folder.user_id == current_user.id,
        models.Folder.language_id == word.language_id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    entry = normalize_entry(word.word)
    translation = normalize_entry(word.translation)
    if not entry or not translation:
        raise HTTPException(status_code=400, detail={"code": "empty_entry"})

    existing_words = db.query(models.Word.word).filter(
        models.Word.module_id == word.module_id
    ).all()
    duplicate = any(normalize_entry(value).lower() == entry.lower() for (value,) in existing_words)
    is_phrase = sum(bool(re.search(r"[^\W\d_]", part)) for part in entry.split()) > 1
    language_code = language.code

    # =========================
    # WORD VALIDATION
    # =========================

    try:
        is_valid_word = validate_word_exists(entry, language_code)
    except DictionaryUnavailable:
        if not is_phrase:
            raise HTTPException(
                status_code=503,
                detail={"code": "dictionary_unavailable"}
            ) from None
        is_valid_word = False

    if not is_valid_word and not is_phrase:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_word"}
        )

    warnings = []
    if duplicate and not word.allow_duplicate:
        warnings.append("duplicate")
    if not is_valid_word and is_phrase and not word.allow_unverified_phrase:
        warnings.append("unverified_phrase")
    if warnings:
        raise HTTPException(
            status_code=409,
            detail={"code": "word_confirmation_required", "warnings": warnings}
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
        word=entry,
        translation=translation,
        example=word.example,
        language_id=word.language_id,
        module_id=word.module_id
    )

    try:
        db.add(new_word)
        db.flush()
        review_state = models.ReviewState(
            word_id=new_word.id,
            repetition=0,
            interval=1,
            ef="2.5",
            next_review=None
        )
        db.add(review_state)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise

    db.refresh(new_word)

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

    return db.query(models.Word).join(
        models.Module,
        models.Word.module_id == models.Module.id
    ).join(
        models.Folder,
        models.Module.folder_id == models.Folder.id
    ).filter(
        models.Folder.user_id == current_user.id,
        models.Word.language_id == language_id
    ).all()

# =========================
# DELETE WORDS
# =========================
@router.delete("/{word_id}")
def delete_word(
    word_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    word = db.query(models.Word).join(
        models.Module,
        models.Word.module_id == models.Module.id
    ).join(
        models.Folder,
        models.Module.folder_id == models.Folder.id
    ).filter(
        models.Word.id == word_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    db.delete(word)
    db.commit()

    return {"message": "Word deleted successfully"}

@router.get("/module/{module_id}")
def get_words_by_module(
    module_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    module = db.query(models.Module).join(models.Folder).filter(
        models.Module.id == module_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    words = db.query(models.Word).filter(
        models.Word.module_id == module_id
    ).all()

    return words

@router.patch("/{word_id}/mastered")
def update_word_mastered(
    word_id: int,
    payload: schemas.WordMasteredUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    word = db.query(models.Word).join(
        models.Module,
        models.Word.module_id == models.Module.id
    ).join(
        models.Folder,
        models.Module.folder_id == models.Folder.id
    ).filter(
        models.Word.id == word_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    was_mastered = bool(word.is_mastered)
    new_mastered = bool(payload.is_mastered)

    word.is_mastered = new_mastered

    if new_mastered and not was_mastered:
        word.mastered_at = datetime.utcnow()
    elif not new_mastered:
        word.mastered_at = None

    db.commit()
    db.refresh(word)

    return {
        "message": "Word mastered status updated",
        "word_id": word.id,
        "is_mastered": word.is_mastered,
        "mastered_at": word.mastered_at
    }
