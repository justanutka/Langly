from pydantic import BaseModel


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
    word: str
    translation: str
    example: str | None = None