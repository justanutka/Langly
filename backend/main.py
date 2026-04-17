from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base

from .routers import users
from .routers import languages
from .routers import words
from .routers import study
from .routers import folders
from .routers import modules
from .routers import quiz


app = FastAPI(title="Langly API")

Base.metadata.create_all(bind=engine)


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