from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Set
from datetime import date
import hashlib

app = FastAPI(title="Language Learning App")

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later you can restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- SIMPLE "DB" (in memory for now) ----------


class User(BaseModel):
    email: EmailStr
    password_hash: str
    target_language: str | None = None  # e.g. "en", "de", "es", "fr"


# key = email (lowercase)
users_db: Dict[str, User] = {}


class Folder(BaseModel):
    id: int
    owner_email: EmailStr
    name: str
    parent_id: int | None = None
    language_code: str | None = None  # optional, e.g. "en"


folders_db: Dict[int, Folder] = {}
next_folder_id: int = 1


class Word(BaseModel):
    id: int
    owner_email: EmailStr
    language_code: str          # language being learned
    source_text: str            # word in target language
    translation: str            # translation (e.g. to Polish)
    folder_id: int | None = None


# key = id
words_db: Dict[int, Word] = {}
next_word_id: int = 1


class ReviewState(BaseModel):
    word_id: int
    repetition: int = 0
    interval: int = 1
    ef: float = 2.5
    next_review_day: int = 0  # stored as ordinal day number


# key = word_id
review_db: Dict[int, ReviewState] = {}


def today_day() -> int:
    return date.today().toordinal()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def is_password_strong(pw: str) -> bool:
    """
    Conditions:
    - at least 7 characters
    - at least 1 letter
    - at least 1 digit
    """
    if len(pw) < 7:
        return False
    has_letter = any(c.isalpha() for c in pw)
    has_digit = any(c.isdigit() for c in pw)
    return has_letter and has_digit


# ---------- Schemas ----------


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    accept_terms: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    email: EmailStr
    message: str
    target_language: str | None = None


class LanguageRequest(BaseModel):
    email: EmailStr
    language_code: str


class AddWordRequest(BaseModel):
    email: EmailStr
    language_code: str
    source_text: str
    translation: str
    folder_id: int | None = None


class GradeRequest(BaseModel):
    email: EmailStr
    word_id: int
    grade: int    # 0–5


class UserPublic(BaseModel):
    email: EmailStr
    target_language: str | None = None


class FolderCreate(BaseModel):
    email: EmailStr
    name: str
    parent_id: int | None = None
    language_code: str | None = None


class FolderOut(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    language_code: str | None = None
    full_path: str


# --- Password reset schemas ---

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str
    confirm_new_password: str


# ---------- HELPERS FOR FOLDERS ----------

def build_full_path(folder: Folder) -> str:
    parts: List[str] = []
    current = folder
    while current is not None:
        parts.append(current.name)
        if current.parent_id is None:
            break
        parent = folders_db.get(current.parent_id)
        if parent is None:
            break
        current = parent
    return " / ".join(reversed(parts))


def folder_to_out(folder: Folder) -> FolderOut:
    return FolderOut(
        id=folder.id,
        name=folder.name,
        parent_id=folder.parent_id,
        language_code=folder.language_code,
        full_path=build_full_path(folder),
    )


def get_descendant_folder_ids(root_id: int, owner_email: str) -> Set[int]:
    """
    All folders: root + все подпапки.
    Используется в /api/study, чтобы урок включал подпапки (Lesson 1 -> Fruits, Animals...)
    """
    result: Set[int] = set()
    queue: List[int] = [root_id]

    while queue:
        fid = queue.pop(0)
        folder = folders_db.get(fid)
        if folder is None or folder.owner_email.lower() != owner_email:
            continue
        if fid in result:
            continue
        result.add(fid)
        for child in folders_db.values():
            if child.owner_email.lower() == owner_email and child.parent_id == fid:
                queue.append(child.id)

    return result


# ---------- BASIC ROUTES ----------

@app.get("/")
def read_root():
    return {"message": "Hello from Language Learning App API"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ---------- AUTH ROUTES ----------

@app.post("/api/signup", response_model=AuthResponse)
def signup(payload: SignUpRequest):
    email = payload.email.lower()

    # must accept Terms
    if not payload.accept_terms:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms to create an account.",
        )

    # passwords must match
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    # password strength: at least 7 chars, 1 letter, 1 digit
    if not is_password_strong(payload.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 7 characters long and contain at least one letter and one digit.",
        )

    if email in users_db:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists",
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
    )
    users_db[email] = user

    return AuthResponse(
        email=email,
        message="User created successfully",
        target_language=None,
    )


@app.post("/api/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    email = payload.email.lower()
    user = users_db.get(email)

    if user is None or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    return AuthResponse(
        email=email,
        message="Login successful",
        target_language=user.target_language,
    )


# ---------- PASSWORD RESET ROUTES ----------

@app.post("/api/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """
    Простая заглушка "забыл пароль".
    В реальном приложении здесь бы отправлялось письмо.
    """
    email = payload.email.lower()
    if email not in users_db:
        # Чтобы не раскрывать, есть ли такой пользователь,
        # отвечаем тем же сообщением
        return {"message": "If this email exists, a reset link has been sent."}

    return {"message": "If this email exists, a reset link has been sent."}


@app.post("/api/reset-password")
def reset_password(payload: ResetPasswordRequest):
    """
    Смена пароля по email (используется на forgot-password.html).
    """
    email = payload.email.lower()
    user = users_db.get(email)
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    if not is_password_strong(payload.new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 7 characters long and contain at least one letter and one digit.",
        )

    user.password_hash = hash_password(payload.new_password)
    users_db[email] = user

    return {"message": "Password has been reset successfully."}


# ---------- USER INFO ROUTE ----------

@app.get("/api/user", response_model=UserPublic)
def get_user(email: EmailStr):
    """
    Return basic user info (email + target_language) for profile page.
    """
    email_lc = email.lower()
    user = users_db.get(email_lc)
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    return UserPublic(email=user.email, target_language=user.target_language)


# ---------- LANGUAGE ROUTE ----------

@app.post("/api/set-language")
def set_language(payload: LanguageRequest):
    """
    Set target language for the given user.
    Called from choose-language.html and profile.html.
    """
    email = payload.email.lower()
    user = users_db.get(email)

    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    user.target_language = payload.language_code
    users_db[email] = user

    return {"email": email, "target_language": user.target_language}


# ---------- FOLDERS ROUTES ----------

@app.post("/api/folders", response_model=FolderOut)
def create_folder(payload: FolderCreate):
    """
    Create a folder (lesson/module). parent_id = None -> root folder.
    Если parent_id задан, создаём подпапку.
    """
    global next_folder_id

    email_lc = payload.email.lower()
    if email_lc not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    if payload.parent_id is not None:
        parent = folders_db.get(payload.parent_id)
        if parent is None or parent.owner_email.lower() != email_lc:
            raise HTTPException(
                status_code=400,
                detail="Parent folder not found for this user",
            )

    folder = Folder(
        id=next_folder_id,
        owner_email=email_lc,
        name=payload.name,
        parent_id=payload.parent_id,
        language_code=payload.language_code,
    )
    folders_db[next_folder_id] = folder
    next_folder_id += 1

    return folder_to_out(folder)


@app.get("/api/folders", response_model=List[FolderOut])
def list_folders(email: EmailStr, language_code: str | None = None):
    """
    List all folders for a user (optionally filtered by language).
    """
    email_lc = email.lower()
    if email_lc not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    relevant: List[FolderOut] = []
    for folder in folders_db.values():
        if folder.owner_email.lower() != email_lc:
            continue
        if language_code is not None and folder.language_code != language_code:
            continue
        relevant.append(folder_to_out(folder))

    # сортируем по пути (Lesson 1 / Fruits, Lesson 1 / Animals, ...)
    relevant.sort(key=lambda f: f.full_path.lower())
    return relevant


# ---------- WORDS ROUTES ----------

@app.post("/api/words", response_model=Word)
def add_word(payload: AddWordRequest):
    """
    Add a new word for the given user and language.
    """
    global next_word_id

    email = payload.email.lower()
    if email not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    folder_id = payload.folder_id
    if folder_id is not None:
        folder = folders_db.get(folder_id)
        if folder is None or folder.owner_email.lower() != email:
            raise HTTPException(
                status_code=400,
                detail="Folder not found for this user",
            )

    word = Word(
        id=next_word_id,
        owner_email=email,
        language_code=payload.language_code,
        source_text=payload.source_text,
        translation=payload.translation,
        folder_id=folder_id,
    )
    words_db[next_word_id] = word
    next_word_id += 1

    return word


@app.get("/api/words", response_model=List[Word])
def list_words(
    email: EmailStr,
    language_code: str | None = None,
    folder_id: int | None = None,
):
    """
    Return words for a given user (and optionally language + folder).
    """
    email_lc = email.lower()
    if email_lc not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    result: List[Word] = []
    for word in words_db.values():
        if word.owner_email.lower() != email_lc:
            continue
        if language_code is not None and word.language_code != language_code:
            continue
        if folder_id is not None and word.folder_id != folder_id:
            continue
        result.append(word)

    return result


@app.delete("/api/words/{word_id}")
def delete_word(word_id: int, email: EmailStr):
    """
    Delete a word (and its review state) for this user.
    """
    email_lc = email.lower()
    if email_lc not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    word = words_db.get(word_id)
    if word is None or word.owner_email.lower() != email_lc:
        raise HTTPException(status_code=400, detail="Word not found for this user")

    if word_id in review_db:
        del review_db[word_id]
    del words_db[word_id]

    return {"status": "deleted"}


# ---------- SM2 HELPER ----------

def sm2_update(state: ReviewState, grade: int) -> ReviewState:
    """
    Update review state for a given grade using SM2 algorithm.
    grade: 0–5 (0 = complete blackout, 5 = perfect)
    """
    if grade < 0 or grade > 5:
        raise HTTPException(status_code=400, detail="Grade must be between 0 and 5")

    # update EF (easiness factor)
    ef = state.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    if ef < 1.3:
        ef = 1.3
    state.ef = ef

    if grade < 3:
        # answer was bad → reset repetition
        state.repetition = 0
        state.interval = 1
    else:
        # good enough
        if state.repetition == 0:
            state.interval = 1
        elif state.repetition == 1:
            state.interval = 6
        else:
            state.interval = int(round(state.interval * state.ef))
        state.repetition += 1

    state.next_review_day = today_day() + state.interval
    return state


def get_or_create_review(word_id: int) -> ReviewState:
    if word_id in review_db:
        return review_db[word_id]
    state = ReviewState(
        word_id=word_id,
        repetition=0,
        interval=1,
        ef=2.5,
        next_review_day=today_day(),  # due today
    )
    review_db[word_id] = state
    return state


# ---------- STUDY ROUTES ----------

@app.get("/api/study", response_model=List[Word])
def get_study_words(
    email: EmailStr,
    language_code: str | None = None,
    folder_id: int | None = None,
    limit: int = 20,
):
    """
    Return words that are 'due' for study for this user and language.
    If folder_id is provided, take words from that folder + all its subfolders.
    """
    email_lc = email.lower()
    if email_lc not in users_db:
        raise HTTPException(status_code=400, detail="User not found")

    today = today_day()
    due: List[Word] = []

    allowed_folder_ids: Set[int] | None = None
    if folder_id is not None:
        allowed_folder_ids = get_descendant_folder_ids(
            folder_id, owner_email=email_lc
        )

    for word in words_db.values():
        if word.owner_email.lower() != email_lc:
            continue
        if language_code is not None and word.language_code != language_code:
            continue
        if allowed_folder_ids is not None and word.folder_id not in allowed_folder_ids:
            continue

        state = review_db.get(word.id)
        # если нет состояния — считаем, что слово пора учить
        if state is None or state.next_review_day <= today:
            due.append(word)

        if len(due) >= limit:
            break

    return due


@app.post("/api/study/grade")
def grade_word(payload: GradeRequest):
    """
    Apply SM2 grade for a given word.
    """
    email_lc = payload.email.lower()
    user = users_db.get(email_lc)
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    word = words_db.get(payload.word_id)
    if word is None or word.owner_email.lower() != email_lc:
        raise HTTPException(status_code=400, detail="Word not found for this user")

    state = get_or_create_review(word.id)
    sm2_update(state, payload.grade)
    review_db[word.id] = state

    return {"status": "ok", "next_review_day": state.next_review_day}
