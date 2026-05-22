from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, database, models, schemas
from ..stats import get_or_create_user_language, xp_needed_for_level

router = APIRouter(prefix="/lessons", tags=["Lessons"])


def calculate_lesson_xp(score: int, total_tasks: int, words_reviewed: int) -> int:
    if total_tasks <= 0:
        return min(8, max(2, words_reviewed))

    percent = score / total_tasks
    base_xp = 6

    if percent == 1:
        base_xp = 16
    elif percent >= 0.8:
        base_xp = 12
    elif percent >= 0.6:
        base_xp = 9

    return base_xp + min(4, max(0, words_reviewed // 3))


def apply_xp_and_level_up(user_language: models.UserLanguage, earned_xp: int):
    user_language.xp += earned_xp

    while True:
        xp_needed = xp_needed_for_level(user_language.level)
        if user_language.xp < xp_needed:
            break
        user_language.xp -= xp_needed
        user_language.level += 1


@router.post("/attempt")
def save_lesson_attempt(
    payload: schemas.LessonAttemptCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    module = db.query(models.Module).join(models.Folder).filter(
        models.Module.id == payload.module_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not module.folder or not module.folder.language_id:
        raise HTTPException(status_code=400, detail="Module language not found")

    total_tasks = max(0, int(payload.total_tasks or 0))
    score = max(0, min(int(payload.score or 0), total_tasks))
    words_reviewed = max(0, int(payload.words_reviewed or 0))
    xp_earned = calculate_lesson_xp(score, total_tasks, words_reviewed)

    attempt = models.LessonAttempt(
        user_id=current_user.id,
        module_id=payload.module_id,
        score=score,
        total_tasks=total_tasks,
        words_reviewed=words_reviewed,
        xp_earned=xp_earned
    )

    db.add(attempt)

    user_language = get_or_create_user_language(
        db, user_id=current_user.id, language_id=module.folder.language_id
    )
    apply_xp_and_level_up(user_language, xp_earned)

    db.commit()
    db.refresh(attempt)

    return {
        "message": "Lesson attempt saved",
        "attempt_id": attempt.id,
        "xp_earned": xp_earned,
        "new_level": user_language.level,
        "current_xp": user_language.xp
    }


@router.get("/history/{module_id}", response_model=list[schemas.LessonAttemptOut])
def get_lesson_history_for_module(
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

    return db.query(models.LessonAttempt).filter(
        models.LessonAttempt.user_id == current_user.id,
        models.LessonAttempt.module_id == module_id
    ).order_by(models.LessonAttempt.created_at.desc()).all()
