import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic import command
from alembic.config import Config
from contextlib import asynccontextmanager
from pathlib import Path

from .database import DATABASE_URL

from .routers import users
from .routers import languages
from .routers import words
from .routers import study
from .routers import folders
from .routers import modules
from .routers import quiz
from .routers import lessons
from .routers import notes


@asynccontextmanager
async def lifespan(app):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")
    yield


app = FastAPI(title="Langly API", lifespan=lifespan)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in os.getenv("LANGLY_FRONTEND_ORIGINS", "").split(",")
        if origin.strip()
    ],
    allow_origin_regex=r"https?://(?:127\.0\.0\.1|localhost)(?::[0-9]+)?",
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
