import sqlite3
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi import HTTPException, Request, Response
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import models, schemas
from backend.database import enforce_foreign_keys
from backend.routers import folders, lessons, modules, notes, quiz, users, words


class DatabaseIntegrityTests(unittest.TestCase):
    def setUp(self):
        with NamedTemporaryFile(suffix=".db", delete=False) as file:
            self.path = Path(file.name)
        self.addCleanup(self.path.unlink)
        self.config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        url = "sqlite:///" + self.path.as_posix()
        self.config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
        self.config.attributes["configure_logger"] = False
        self.engine = create_engine(url)
        event.listen(self.engine, "connect", enforce_foreign_keys)
        self.addCleanup(self.engine.dispose)
        self.request = Request({"type": "http", "scheme": "http", "path": "/", "headers": []})

    def register(self, db, email):
        payload = schemas.UserCreate(email=email, password="Example123", native_language_id=2)
        return users.register(payload, self.request, Response(), db)

    def test_concurrent_registration(self):
        command.upgrade(self.config, "head")
        barrier = Barrier(2)

        def synchronize(db, context, instances):
            if any(isinstance(row, models.User) for row in db.new):
                barrier.wait(timeout=10)

        def register(email):
            with Session(self.engine) as db:
                event.listen(db, "before_flush", synchronize)
                try:
                    return bool(self.register(db, email)["access_token"])
                except HTTPException as exc:
                    return exc.status_code, exc.detail

        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(register, [" User@Example.org ", "user@example.org"]))
        self.assertCountEqual(results, [True, (400, "Email already registered")])
        with Session(self.engine) as db:
            self.assertEqual(db.query(models.User).one().email, "user@example.org")
            form = SimpleNamespace(username=" USER@example.org ", password="Example123")
            self.assertTrue(users.login(self.request, Response(), form, db)["access_token"])

    def test_migration_preserves_detached_word_and_rolls_back_invalid_links(self):
        command.upgrade(self.config, "f2c814a6d390")
        with self.engine.begin() as connection:
            connection.exec_driver_sql("INSERT INTO words(id, word, translation) VALUES (10, 'go', 'gehen')")
            connection.exec_driver_sql("INSERT INTO review_states(id, word_id) VALUES (5, 10)")
        raw = sqlite3.connect(self.path)
        try:
            raw.execute("UPDATE words SET language_id = 99")
            raw.commit()
            with self.assertRaisesRegex(RuntimeError, "Invalid reference"):
                command.upgrade(self.config, "head")
            self.assertEqual(raw.execute("SELECT version_num FROM alembic_version").fetchone(), ("f2c814a6d390",))
            raw.execute("UPDATE words SET language_id = 1")
            raw.commit()
        finally:
            raw.close()
        command.upgrade(self.config, "head")
        with self.engine.begin() as connection:
            self.assertEqual(connection.exec_driver_sql("SELECT id, module_id FROM words").one(), (10, None))
            self.assertEqual(connection.exec_driver_sql("SELECT id, word_id FROM review_states").one(), (5, 10))
            with self.assertRaises(IntegrityError):
                connection.exec_driver_sql("INSERT INTO words(word, translation) VALUES ('new', 'neu')")

    def test_unversioned_accounts_are_never_merged(self):
        command.upgrade(self.config, "f2c814a6d390")
        with self.engine.begin() as connection:
            connection.exec_driver_sql("DROP TABLE alembic_version")
            connection.exec_driver_sql("""INSERT INTO users
                (id, email, password_hash, streak, level, xp, freeze_days)
                VALUES (?, ?, 'fixture', 0, 1, 0, 1)""",
                [(1, " A@example.org "), (2, "a@example.org")])
        with self.assertRaisesRegex(RuntimeError, "duplicate emails"):
            command.upgrade(self.config, "head")
        with self.engine.begin() as connection:
            self.assertEqual(connection.exec_driver_sql("SELECT id, email FROM users ORDER BY id").all(),
                             [(1, " A@example.org "), (2, "a@example.org")])
            connection.exec_driver_sql("UPDATE users SET email = 'b@example.org' WHERE id = 2")
        command.upgrade(self.config, "head")
        with self.engine.begin() as connection:
            self.assertEqual(connection.exec_driver_sql("SELECT id, email FROM users ORDER BY id").all(),
                             [(1, "a@example.org"), (2, "b@example.org")])
            with self.assertRaises(IntegrityError):
                connection.exec_driver_sql("UPDATE users SET email = 'A@example.org' WHERE id = 2")

    def make_module(self, db, owner, folder_id):
        module_id = modules.create_module(folder_id, "Test", db, owner).id
        payload = schemas.WordCreate(module_id=module_id, language_id=1, word="go", translation="gehen")
        with patch.object(words, "validate_word_exists", return_value=True), patch.object(words, "check_spelling", return_value=[]):
            first = words.create_word(payload, owner, db).id
            payload.allow_duplicate = True
            second = words.create_word(payload, owner, db).id
        self.assertNotEqual(first, second)
        answer = schemas.QuizAnswerCreate(word_id=first, question_type="choice", is_correct=True)
        attempt = schemas.QuizAttemptCreate(module_id=module_id, quiz_type="choice", score=1, total_questions=1, answers=[answer])
        quiz_id = quiz.save_quiz_attempt(attempt, owner, db)["attempt_id"]
        lesson = schemas.LessonAttemptCreate(module_id=module_id, score=1, total_tasks=1, words_reviewed=1)
        lesson_id = lessons.save_lesson_attempt(lesson, owner, db)["attempt_id"]
        return module_id, first, second, quiz_id, lesson_id

    def assert_module_data(self, db, record, expected):
        module, first, second, attempt, lesson = record
        self.assertEqual(db.get(models.Module, module) is not None, expected)
        self.assertEqual(db.query(models.Word).filter(models.Word.id.in_([first, second])).count(), 2 * expected)
        self.assertEqual(db.query(models.ReviewState).filter(models.ReviewState.word_id.in_([first, second])).count(), 2 * expected)
        self.assertEqual(db.get(models.QuizAttempt, attempt) is not None, expected)
        self.assertEqual(db.query(models.QuizAnswer).filter_by(attempt_id=attempt).count(), int(expected))
        self.assertEqual(db.get(models.LessonAttempt, lesson) is not None, expected)

    def test_cascades_rollback_and_isolation(self):
        command.upgrade(self.config, "head")
        with Session(self.engine) as db:
            self.register(db, "first@example.org")
            self.register(db, "second@example.org")
            owner, other = db.query(models.User).order_by(models.User.id).all()
            for user in (owner, other):
                users.set_language(1, user, db)
            notes.create_note(schemas.NoteCreate(title="Note", content="Contents"), owner, db)
            users.set_language(3, owner, db)
            self.assertEqual(notes.get_notes(owner, db), [])
            users.set_language(1, owner, db)
            folder_ids = [folders.create_folder(schemas.FolderCreate(name="Folder"), user, db).id
                          for user in (owner, owner, other)]
            first, second, sibling, foreign = [
                self.make_module(db, user, folder_id) for user, folder_id in
                [(owner, folder_ids[0]), (owner, folder_ids[0]), (owner, folder_ids[1]), (other, folder_ids[2])]
            ]
            answer = schemas.QuizAnswerCreate(word_id=foreign[1], question_type="choice", is_correct=True)
            mixed = schemas.QuizAttemptCreate(module_id=first[0], quiz_type="choice", score=1, total_questions=1, answers=[answer])
            with self.assertRaises(HTTPException) as exc:
                quiz.save_quiz_attempt(mixed, owner, db)
            self.assertEqual(exc.exception.status_code, 400)
            with self.assertRaises(IntegrityError):
                db.execute(text("DELETE FROM languages WHERE id = 1"))
            db.rollback()
            db.execute(text("""CREATE TEMP TRIGGER stop_deletion BEFORE DELETE ON review_states
                BEGIN SELECT RAISE(ABORT, 'interrupted'); END"""))
            with self.assertRaises(IntegrityError):
                folders.delete_folder(folder_ids[0], owner, db)
            db.rollback()
            for record in (first, second, sibling, foreign):
                self.assert_module_data(db, record, True)
            db.execute(text("DROP TRIGGER stop_deletion"))
            modules.delete_module(first[0], db, owner)
            self.assert_module_data(db, first, False)
            self.assert_module_data(db, second, True)
            folders.delete_folder(folder_ids[0], owner, db)
            self.assert_module_data(db, second, False)
            for record in (sibling, foreign):
                self.assert_module_data(db, record, True)
            self.assertEqual([note.title for note in notes.get_notes(owner, db)], ["Note"])
            self.assertEqual(db.execute(text("PRAGMA foreign_key_check")).all(), [])
