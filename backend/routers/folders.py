from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, database, auth

router = APIRouter(prefix="/folders", tags=["Folders"])


# GET folders for active language
@router.get("/")
def get_folders(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    if not current_user.active_language_id:
        return []

    return db.query(models.Folder).filter(
        models.Folder.user_id == current_user.id,
        models.Folder.language_id == current_user.active_language_id
    ).all()


# CREATE folder
@router.post("/")
def create_folder(
    name: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    if not current_user.active_language_id:
        raise HTTPException(status_code=400, detail="Select language first")

    folder = models.Folder(
        name=name,
        user_id=current_user.id,
        language_id=current_user.active_language_id
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)

    return folder