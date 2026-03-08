from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from datetime import date
from sqlalchemy import UniqueConstraint
from sqlalchemy import ForeignKey



class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)

    streak = Column(Integer, default=0)
    last_study_date = Column(String, nullable=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    freeze_days = Column(Integer, default=1)

    active_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    active_language = relationship("Language", foreign_keys=[active_language_id])
    native_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    native_language = relationship("Language", foreign_keys=[native_language_id])

    achievements = relationship("Achievement", backref="user")
    user_languages = relationship("UserLanguage", back_populates="user",cascade="all, delete")
    
    
class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)

    words = relationship("Word", back_populates="language")

    users = relationship(
        "UserLanguage",
        back_populates="language",
        cascade="all, delete"
    )

class UserLanguage(Base):
    __tablename__ = "user_languages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))

    user = relationship("User", back_populates="user_languages")
    language = relationship("Language", back_populates="users")

class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)

    word = Column(String, nullable=False)
    translation = Column(String, nullable=False)
    example = Column(String, nullable=True)

    language_id = Column(Integer, ForeignKey("languages.id"))
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)

    language = relationship("Language", back_populates="words")
    review_state = relationship("ReviewState", back_populates="word", uselist=False)

    __table_args__ = (
        UniqueConstraint('language_id', 'word', name='unique_word_per_language'),
    )

class ReviewState(Base):
    __tablename__ = "review_states"

    id = Column(Integer, primary_key=True, index=True)

    word_id = Column(Integer, ForeignKey("words.id"))

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

    created_at = Column(DateTime, default=datetime.utcnow)

    modules = relationship("Module", back_populates="folder", cascade="all, delete")

class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    folder_id = Column(Integer, ForeignKey("folders.id"))

    created_at = Column(DateTime, default=datetime.utcnow)

    folder = relationship("Folder", back_populates="modules")
    words = relationship("Word")