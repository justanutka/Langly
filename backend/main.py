from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import engine, Base

from .routers import users
from .routers import languages
from .routers import words
from .routers import study
from .routers import folders
from .routers import modules
from .routers import quiz
from .routers import lessons
from .routers import notes


app = FastAPI(title="Langly API")

Base.metadata.create_all(bind=engine)


def ensure_runtime_schema():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "interface_language_id" not in user_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN interface_language_id INTEGER"))
                connection.execute(
                    text(
                        """
                        UPDATE users
                        SET interface_language_id = native_language_id
                        WHERE interface_language_id IS NULL
                        """
                    )
                )

    if "notes" in table_names:
        note_columns = {column["name"] for column in inspector.get_columns("notes")}
        if "language_id" not in note_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE notes ADD COLUMN language_id INTEGER"))
                connection.execute(
                    text(
                        """
                        UPDATE notes
                        SET language_id = COALESCE(
                            (SELECT id FROM languages WHERE code = 'en' LIMIT 1),
                            (
                                SELECT COALESCE(users.active_language_id, users.native_language_id)
                                FROM users
                                WHERE users.id = notes.user_id
                            )
                        )
                        WHERE language_id IS NULL
                        """
                    )
                )


ensure_runtime_schema()


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# routers
app.include_router(users.router)
app.include_router(languages.router)
app.include_router(words.router)
app.include_router(study.router)
app.include_router(folders.router)
app.include_router(modules.router)
app.include_router(quiz.router)
app.include_router(lessons.router)
app.include_router(notes.router)
