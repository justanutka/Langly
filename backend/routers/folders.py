from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, database, auth
from backend.schemas import FolderCreate

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
    data: FolderCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    if not current_user.active_language_id:
        raise HTTPException(status_code=400, detail="Select language first")

    folder = models.Folder(
        name=data.name,
        description=data.description,
        emoji=data.emoji,
        user_id=current_user.id,
        language_id=current_user.active_language_id
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)

    return folder

# DELETE folder
@router.delete("/{folder_id}")
def delete_folder(
    folder_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):

    folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.user_id == current_user.id
    ).first()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    db.delete(folder)
    db.commit()

    return {"message": "Folder deleted"}

