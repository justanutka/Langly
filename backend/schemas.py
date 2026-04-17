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

class QuizAnswerCreate(BaseModel):
    word_id: int
    question_type: str
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: bool


class QuizAttemptCreate(BaseModel):
    module_id: int
    quiz_type: str
    score: int
    total_questions: int
    answers: list[QuizAnswerCreate]


class QuizAnswerOut(BaseModel):
    id: int
    word_id: int
    question_type: str
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: bool

    class Config:
        from_attributes = True


class QuizAttemptOut(BaseModel):
    id: int
    module_id: int
    quiz_type: str
    score: int
    total_questions: int
    xp_earned: int
    answers: list[QuizAnswerOut] = []

    class Config:
        from_attributes = True