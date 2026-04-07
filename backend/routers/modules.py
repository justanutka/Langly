from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, database, auth

router = APIRouter(prefix="/modules", tags=["Modules"])


@router.get("/{folder_id}")
def get_modules(
    folder_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):

    return db.query(models.Module).filter(
        models.Module.folder_id == folder_id
    ).all()


@router.post("/")
def create_module(
    folder_id: int,
    name: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):

    module = models.Module(
        name=name,
        folder_id=folder_id
    )

    db.add(module)
    db.commit()
    db.refresh(module)

    return module

#DELETE 
@router.delete("/{module_id}")
def delete_module(
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

    db.delete(module)
    db.commit()

    return {"message": "Module deleted"}