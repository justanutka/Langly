from fastapi import FastAPI
from .database import engine, Base
from .routers import users
from .routers import users, languages
from .routers import users, languages, words
from .routers import study
from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Langly API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(languages.router)
app.include_router(words.router)
app.include_router(study.router)