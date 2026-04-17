from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from .. import models, schemas, database, auth

router = APIRouter(prefix="/quiz", tags=["Quiz"])


def calculate_quiz_xp(score: int, total_questions: int) -> int:
    if total_questions <= 0:
        return 0

    percent = score / total_questions

    if percent == 1:
        return 20
    if percent >= 0.8:
        return 15
    if percent >= 0.6:
        return 10
    if percent >= 0.4:
        return 5
    return 2


def apply_xp_and_level_up(user: models.User, earned_xp: int):
    user.xp += earned_xp

    while True:
        xp_needed = int(100 * (user.level ** 1.5))
        if user.xp < xp_needed:
            break
        user.xp -= xp_needed
        user.level += 1


@router.post("/attempt")
def save_quiz_attempt(
    payload: schemas.QuizAttemptCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    module = db.query(models.Module).join(models.Folder).filter(
        models.Module.id == payload.module_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    xp_earned = calculate_quiz_xp(payload.score, payload.total_questions)

    attempt = models.QuizAttempt(
        user_id=current_user.id,
        module_id=payload.module_id,
        quiz_type=payload.quiz_type,
        score=payload.score,
        total_questions=payload.total_questions,
        xp_earned=xp_earned
    )

    db.add(attempt)
    db.flush()

    for answer in payload.answers:
        quiz_answer = models.QuizAnswer(
            attempt_id=attempt.id,
            word_id=answer.word_id,
            question_type=answer.question_type,
            user_answer=answer.user_answer,
            correct_answer=answer.correct_answer,
            is_correct=answer.is_correct
        )
        db.add(quiz_answer)

    apply_xp_and_level_up(current_user, xp_earned)

    db.commit()
    db.refresh(attempt)

    return {
        "message": "Quiz attempt saved",
        "attempt_id": attempt.id,
        "xp_earned": xp_earned,
        "new_level": current_user.level,
        "current_xp": current_user.xp
    }


@router.get("/history/{module_id}")
def get_quiz_history_for_module(
    module_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    module = db.query(models.Module).join(models.Folder).filter(
        models.Module.id == module_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    attempts = db.query(models.QuizAttempt).options(
        joinedload(models.QuizAttempt.answers)
    ).filter(
        models.QuizAttempt.user_id == current_user.id,
        models.QuizAttempt.module_id == module_id
    ).order_by(
        models.QuizAttempt.created_at.desc()
    ).all()

    return attempts