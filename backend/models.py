from sqlalchemy import CheckConstraint, Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from datetime import date



class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email = trim(email, char(9,10,11,12,13,32))", name="ck_users_email_trimmed"),
    )

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(collation="NOCASE"), nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)

    streak = Column(Integer, default=0)
    last_study_date = Column(String, nullable=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    freeze_days = Column(Integer, default=1)

    active_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    active_language = relationship("Language", foreign_keys=[active_language_id])
    native_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    native_language = relationship("Language", foreign_keys=[native_language_id])
    interface_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    interface_language = relationship("Language", foreign_keys=[interface_language_id])

    achievements = relationship("Achievement", backref="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete")
    lesson_attempts = relationship("LessonAttempt", back_populates="user", cascade="all, delete")
    user_languages = relationship("UserLanguage", back_populates="user",cascade="all, delete")
    notes = relationship("Note", back_populates="user", cascade="all, delete")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    renewal_hash = Column(String, nullable=False)
    idle_until = Column(DateTime, nullable=False, index=True)
    absolute_until = Column(DateTime, nullable=False)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code_hash = Column(String, nullable=False)
    new_password_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    
class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)

    words = relationship("Word", back_populates="language", passive_deletes="all")

    users = relationship(
        "UserLanguage",
        back_populates="language",
        passive_deletes="all"
    )

class UserLanguage(Base):
    __tablename__ = "user_languages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))

    streak = Column(Integer, default=0)
    last_study_date = Column(String, nullable=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    freeze_days = Column(Integer, default=1)

    user = relationship("User", back_populates="user_languages")
    language = relationship("Language", back_populates="users")
    
class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)

    word = Column(String, nullable=False)
    is_mastered = Column(Boolean, default=False)
    mastered_at = Column(DateTime, nullable=True)
    translation = Column(String, nullable=False)
    example = Column(String, nullable=True)

    language_id = Column(Integer, ForeignKey("languages.id"))
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=True)

    language = relationship("Language", back_populates="words")
    review_state = relationship("ReviewState", back_populates="word", uselist=False, cascade="all, delete", passive_deletes=True)
    quiz_answers = relationship("QuizAnswer", back_populates="word", cascade="all, delete", passive_deletes=True)

class ReviewState(Base):
    __tablename__ = "review_states"

    id = Column(Integer, primary_key=True, index=True)

    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False)

    repetition = Column(Integer, default=0)
    interval = Column(Integer, default=1)
    ef = Column(String, default="2.5")
    next_review = Column(String, nullable=True)

    word = relationship("Word", back_populates="review_state")

class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)

    user_id = Column(Integer, ForeignKey("users.id"))

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))
    description = Column(String, nullable=True)
    emoji = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    modules = relationship("Module", back_populates="folder", cascade="all, delete", passive_deletes=True)

class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    folder = relationship("Folder", back_populates="modules")
    words = relationship("Word", cascade="all, delete", passive_deletes=True)
    quiz_attempts = relationship("QuizAttempt", back_populates="module", cascade="all, delete", passive_deletes=True)
    lesson_attempts = relationship("LessonAttempt", back_populates="module", cascade="all, delete", passive_deletes=True)

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)

    quiz_type = Column(String, nullable=False)
    score = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")
    module = relationship("Module", back_populates="quiz_attempts")
    answers = relationship("QuizAnswer", back_populates="attempt", cascade="all, delete", passive_deletes=True)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False)

    question_type = Column(String, nullable=False)
    user_answer = Column(String, nullable=True)
    correct_answer = Column(String, nullable=True)
    is_correct = Column(Boolean, default=False)

    attempt = relationship("QuizAttempt", back_populates="answers")
    word = relationship("Word", back_populates="quiz_answers")


class LessonAttempt(Base):
    __tablename__ = "lesson_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)

    score = Column(Integer, nullable=False, default=0)
    total_tasks = Column(Integer, nullable=False, default=0)
    words_reviewed = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="lesson_attempts")
    module = relationship("Module", back_populates="lesson_attempts")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    color = Column(String, default="indigo")
    is_important = Column(Boolean, default=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notes")
    language = relationship("Language")
