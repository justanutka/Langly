from __future__ import annotations

from sqlalchemy.orm import Session

from . import models


def get_or_create_user_language(
    db: Session, *, user_id: int, language_id: int
) -> models.UserLanguage:
    user_language = (
        db.query(models.UserLanguage)
        .filter(
            models.UserLanguage.user_id == user_id,
            models.UserLanguage.language_id == language_id,
        )
        .first()
    )

    if user_language:
        return user_language

    user_language = models.UserLanguage(user_id=user_id, language_id=language_id)
    db.add(user_language)
    db.flush()
    return user_language


def xp_needed_for_level(level: int) -> int:
    return int(100 * (level**1.5))

