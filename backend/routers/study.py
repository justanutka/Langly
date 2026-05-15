from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date
from .. import models, database, auth
import requests
import random
from sqlalchemy import or_, func
from ..stats import get_or_create_user_language, xp_needed_for_level


router = APIRouter(prefix="/study", tags=["Study"])

WORD_BANK_EN = [
    "ability", "access", "action", "advice", "answer", "apple", "area", "artist",
    "balance", "basic", "beauty", "benefit", "book", "brain", "bridge", "budget",
    "camera", "career", "chance", "change", "choice", "coffee", "comfort", "common",
    "company", "concept", "context", "control", "culture", "design", "detail", "dream",
    "effort", "energy", "engine", "example", "expert", "family", "feature", "focus",
    "forest", "future", "garden", "goal", "growth", "habit", "health", "history",
    "idea", "impact", "income", "industry", "interest", "journey", "knowledge", "language",
    "lesson", "level", "library", "logic", "market", "memory", "method", "moment",
    "music", "nature", "network", "option", "pattern", "people", "percent", "planet",
    "practice", "problem", "process", "product", "project", "quality", "question", "reason",
    "research", "resource", "result", "routine", "science", "skill", "solution", "space",
    "success", "system", "teacher", "team", "time", "topic", "training", "value",
    "vision", "voice", "weather", "window", "work", "world", "writing",
    "adapt", "agree", "allow", "arrive", "build", "choose", "create",
    "decide", "develop", "discover", "enjoy", "explain", "finish", "follow", "improve",
    "learn", "listen", "manage", "notice", "organize", "remember", "repeat",
    "share", "start", "study", "support", "travel", "understand", "use", "watch",
    "bright", "calm", "clean", "clear", "daily", "easy", "fair",
    "fresh", "gentle", "happy", "helpful", "kind", "modern", "natural", "simple",
    "smart", "strong", "useful", "warm"
]


def _translate_google(text: str, source_lang: str, target_lang: str):
    if not text or source_lang == target_lang:
        return text

    try:
        google_res = requests.get(
            "https://translate.googleapis.com/translate_a/single",
            params={
                "client": "gtx",
                "sl": source_lang,
                "tl": target_lang,
                "dt": "t",
                "q": text
            },
            timeout=5
        )

        if google_res.status_code == 200:
            data = google_res.json()
            return data[0][0][0]
    except Exception:
        return text

    return text


@router.get("/daily-words")
def get_daily_words(
    variant: int = 0,
    count: int = 5,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Stable daily words: deterministic per (user, date, variant)."""
    if not current_user.active_language or not current_user.native_language:
        return []

    study_lang = current_user.active_language.code
    native_lang = current_user.native_language.code

    seed = f"{date.today().isoformat()}:{current_user.id}:{variant}"
    rng = random.Random(seed)

    count = max(1, min(20, int(count)))
    count = min(count, len(WORD_BANK_EN))
    base_words = rng.sample(WORD_BANK_EN, k=count) if count > 0 else []

    result = []
    for word in base_words:
        study_word = _translate_google(word, "en", study_lang) if study_lang != "en" else word
        native_translation = _translate_google(word, "en", native_lang) if native_lang != "en" else word

        result.append({
            "word": study_word,
            "translation": native_translation,
            "base_word": word
        })

    return result


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
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.active_language_id:
        user_language = get_or_create_user_language(
            db, user_id=current_user.id, language_id=current_user.active_language_id
        )
        return {
            "level": user_language.level,
            "xp": user_language.xp,
            "streak": user_language.streak,
        }

    return {
        "level": current_user.level,
        "xp": current_user.xp,
        "streak": current_user.streak
    }


# =========================
# STATS
# =========================
@router.get("/stats")
def get_study_stats(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not current_user.active_language_id:
        return {
            "level": current_user.level,
            "xp": current_user.xp,
            "xp_to_next_level": xp_needed_for_level(current_user.level) - current_user.xp,
            "streak": current_user.streak,
            "freeze_days": current_user.freeze_days,
            "total_words": 0,
            "mastered_words": 0,
            "due_today": 0,
            "progress_percent": 0
        }

    user_language = get_or_create_user_language(
        db, user_id=current_user.id, language_id=current_user.active_language_id
    )

    total_words = db.query(models.Word).filter(
        models.Word.language_id == current_user.active_language_id
    ).count()

    mastered_words = db.query(models.Word).outerjoin(
        models.ReviewState,
        models.Word.id == models.ReviewState.word_id
    ).filter(
        models.Word.language_id == current_user.active_language_id,
        or_(
            models.Word.is_mastered == True,
            models.ReviewState.repetition >= 5
        )
    ).distinct().count()

    today = datetime.utcnow().date()

    due_today = db.query(models.Word).filter(
        models.Word.language_id == current_user.active_language_id,
        models.Word.mastered_at.isnot(None),
        func.date(models.Word.mastered_at) == today
    ).count()

    progress_percent = round((mastered_words / total_words) * 100) if total_words > 0 else 0

    xp_needed = xp_needed_for_level(user_language.level)
    xp_to_next_level = xp_needed - user_language.xp

    return {
        "level": user_language.level,
        "xp": user_language.xp,
        "xp_to_next_level": xp_to_next_level,
        "streak": user_language.streak,
        "freeze_days": user_language.freeze_days,
        "total_words": total_words,
        "mastered_words": mastered_words,
        "due_today": due_today,
        "progress_percent": progress_percent
    }
