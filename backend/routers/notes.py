from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from .. import models, schemas, database, auth

router = APIRouter(prefix="/notes", tags=["Notes"])


def get_active_language_id(current_user: models.User) -> int:
    if not current_user.active_language_id:
        raise HTTPException(status_code=400, detail="Choose an active language first")

    return current_user.active_language_id


@router.get("/", response_model=list[schemas.NoteOut])
def get_notes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    language_id = get_active_language_id(current_user)

    notes = db.query(models.Note).filter(
        models.Note.user_id == current_user.id,
        models.Note.language_id == language_id
    ).order_by(models.Note.is_important.desc(), models.Note.updated_at.desc()).all()

    return notes


@router.post("/", response_model=schemas.NoteOut)
def create_note(
    note: schemas.NoteCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not note.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    if not note.content.strip():
        raise HTTPException(status_code=400, detail="Content is required")

    language_id = get_active_language_id(current_user)

    new_note = models.Note(
        title=note.title.strip(),
        content=note.content.strip(),
        color=note.color,
        is_important=note.is_important,
        user_id=current_user.id,
        language_id=language_id
    )

    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    return new_note


@router.put("/{note_id}", response_model=schemas.NoteOut)
def update_note(
    note_id: int,
    note_data: schemas.NoteUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id,
        models.Note.language_id == get_active_language_id(current_user)
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note_data.title is not None:
        if not note_data.title.strip():
            raise HTTPException(status_code=400, detail="Title is required")
        note.title = note_data.title.strip()

    if note_data.content is not None:
        if not note_data.content.strip():
            raise HTTPException(status_code=400, detail="Content is required")
        note.content = note_data.content.strip()

    if note_data.color is not None:
        note.color = note_data.color

    if note_data.is_important is not None:
        note.is_important = note_data.is_important

    note.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(note)

    return note


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.user_id == current_user.id,
        models.Note.language_id == get_active_language_id(current_user)
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()

    return {"message": "Note deleted"}
