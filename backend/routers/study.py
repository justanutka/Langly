from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date
from .. import models, database, auth
import requests
import random

router = APIRouter(prefix="/study", tags=["Study"])


# =========================
# DAILY WORDS (ACTIVE → NATIVE) — GOOGLE API VERSION
# =========================
@router.get("/daily-words-online")
def get_daily_words_online(
    current_user: models.User = Depends(auth.get_current_user)
):

    if not current_user.active_language or not current_user.native_language:
        return []

    study_lang = current_user.active_language.code
    native_lang = current_user.native_language.code

    today_seed = date.today().isoformat()
    random.seed(today_seed)

    # Получаем 5 random слов (английских)
    try:
        random_words_res = requests.get(
            "https://random-word-api.herokuapp.com/word?number=5",
            timeout=5
        )

        if random_words_res.status_code != 200:
            return []

        words = random_words_res.json()

    except Exception:
        return []

    result = []

    for word in words:

        study_word = word
        native_translation = word

        # Если язык обучения не английский — переводим слово в study язык
        if study_lang != "en":
            try:
                google_res = requests.get(
                    "https://translate.googleapis.com/translate_a/single",
                    params={
                        "client": "gtx",
                        "sl": "en",
                        "tl": study_lang,
                        "dt": "t",
                        "q": word
                    },
                    timeout=5
                )

                if google_res.status_code == 200:
                    data = google_res.json()
                    study_word = data[0][0][0]

            except Exception:
                study_word = word

        if native_lang != "en":
            try:
                google_res = requests.get(
                    "https://translate.googleapis.com/translate_a/single",
                    params={
                        "client": "gtx",
                        "sl": "en",
                        "tl": native_lang,
                        "dt": "t",
                        "q": word
                    },
                    timeout=5
                )

                if google_res.status_code == 200:
                    data = google_res.json()
                    native_translation = data[0][0][0]

            except Exception:
                native_translation = word

        result.append({
            "word": study_word,
            "translation": native_translation
        })

    return result


# =========================
# DASHBOARD
# =========================
@router.get("/dashboard")
def get_dashboard(
    current_user: models.User = Depends(auth.get_current_user)
):
    return {
        "level": current_user.level,
        "xp": current_user.xp,
        "streak": current_user.streak
    }


# =========================
# STATS
# =========================
@router.get("/stats")
def get_study_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    total_words = db.query(models.Word).filter(models.Word.language_id == current_user.active_language_id).count()

    mastered_words = db.query(models.Word).join(models.ReviewState).filter(
        models.Word.language_id == current_user.active_language_id,
        models.ReviewState.repetition >= 5
    ).count()

    due_today = db.query(models.Word).join(models.ReviewState).filter(
        models.Word.language_id == current_user.active_language_id,
        models.ReviewState.next_review <= datetime.utcnow().isoformat()
    ).count()

    progress_percent = (mastered_words / total_words) * 100 if total_words > 0 else 0

    xp_needed = int(100 * (current_user.level ** 1.5))
    xp_to_next_level = xp_needed - current_user.xp

    return {
        "level": current_user.level,
        "xp": current_user.xp,
        "xp_to_next_level": xp_to_next_level,
        "streak": current_user.streak,
        "freeze_days": current_user.freeze_days,
        "total_words": total_words,
        "mastered_words": mastered_words,
        "due_today": due_today,
        "progress_percent": progress_percent
    }