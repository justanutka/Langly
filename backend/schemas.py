from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    email: str
    password: str
    native_language_id: int


class UserLogin(BaseModel):
    email: str
    password: str


class LanguageCreate(BaseModel):
    name: str
    code: str

class WordCreate(BaseModel):
    language_id: int
    module_id: int
    word: str
    translation: str
    example: str | None = None

class FolderCreate(BaseModel):
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = None

class ModuleCreate(BaseModel):
    name: str
    folder_id: int