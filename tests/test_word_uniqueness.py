import runpy
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import models, schemas
from backend.routers import words


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "e7b2f9a1c630_scope_word_uniqueness_to_module.py"


class WordUniquenessTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        models.Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.db.add(models.Language(id=1, name="English", code="en"))
        self.db.add_all([models.User(id=1), models.User(id=2)])
        self.db.flush()
        self.db.add_all([
            models.UserLanguage(user_id=1, language_id=1),
            models.UserLanguage(user_id=2, language_id=1),
            models.Folder(id=1, name="A", user_id=1, language_id=1),
            models.Folder(id=2, name="B", user_id=2, language_id=1),
        ])
        self.db.flush()
        self.db.add_all([
            models.Module(id=1, name="First", folder_id=1),
            models.Module(id=2, name="Second", folder_id=1),
            models.Module(id=3, name="Other user", folder_id=2),
        ])
        self.db.commit()
        for target, value in [("validate_word_exists", True), ("check_spelling", [])]:
            mock = patch.object(words, target, return_value=value)
            mock.start()
            self.addCleanup(mock.stop)

    def add_word(self, module_id, user_id=1):
        return words.create_word(
            schemas.WordCreate(language_id=1, module_id=module_id, word="dog", translation="test"),
            self.db.get(models.User, user_id),
            self.db,
        )

    def test_same_user_can_add_word_to_different_modules(self):
        first = self.add_word(1)
        second = self.add_word(2)
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(self.db.query(models.ReviewState).count(), 2)

    def test_different_users_can_add_same_word(self):
        self.add_word(1)
        self.add_word(3, user_id=2)
        self.assertEqual(self.db.query(models.Word).count(), 2)

    def test_duplicate_in_same_module_returns_clear_error(self):
        self.add_word(1)
        with self.assertRaises(HTTPException) as result:
            self.add_word(1)
        self.assertEqual(result.exception.status_code, 400)
        self.assertEqual(result.exception.detail, "Word already exists in this module")
        self.assertEqual(self.db.query(models.Word).count(), 1)
        self.assertEqual(self.db.query(models.ReviewState).count(), 1)

    def test_database_also_rejects_duplicate(self):
        self.add_word(1)
        self.db.add(models.Word(word="dog", translation="test", module_id=1, language_id=1))
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_cannot_add_to_foreign_or_nonexistent_module(self):
        for module_id in [0, 3, 999]:
            with self.subTest(module_id=module_id):
                with self.assertRaises(HTTPException) as result:
                    self.add_word(module_id)
                self.assertEqual(result.exception.status_code, 404)
        self.assertEqual(self.db.query(models.Word).count(), 0)

    def test_constraint_collision_after_precheck_returns_400(self):
        self.add_word(1)
        query = self.db.query
        hide_duplicate = True

        def query_with_stale_precheck(entity):
            nonlocal hide_duplicate
            if entity is models.Word and hide_duplicate:
                hide_duplicate = False
                stale = Mock()
                stale.filter.return_value.first.return_value = None
                return stale
            return query(entity)

        with patch.object(self.db, "query", side_effect=query_with_stale_precheck):
            with self.assertRaises(HTTPException) as result:
                self.add_word(1)
        self.assertEqual(result.exception.status_code, 400)
        self.assertTrue(self.db.is_active)
        self.assertEqual(self.db.query(models.Word).count(), 1)

    def test_review_failure_rolls_back_word_too(self):
        def fail_review(session, context, instances):
            if any(isinstance(item, models.ReviewState) for item in session.new):
                raise IntegrityError("test", {}, sqlite3.IntegrityError("forced review failure"))

        event.listen(self.db, "before_flush", fail_review)
        try:
            with self.assertRaises(IntegrityError):
                self.add_word(1)
        finally:
            event.remove(self.db, "before_flush", fail_review)
        self.assertEqual(self.db.query(models.Word).count(), 0)
        self.assertEqual(self.db.query(models.ReviewState).count(), 0)

    def test_migration_preserves_words_reviews_and_quiz_history(self):
        migration = runpy.run_path(str(MIGRATION))
        self.db.close()
        with self.engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                migration["downgrade"]()
        first = self.add_word(1)
        attempt = models.QuizAttempt(user_id=1, module_id=1, quiz_type="test", score=1, total_questions=1)
        self.db.add(attempt)
        self.db.flush()
        self.db.add(models.QuizAnswer(attempt_id=attempt.id, word_id=first.id, question_type="test", is_correct=True))
        self.db.commit()
        tables = ["words", "review_states", "quiz_attempts", "quiz_answers"]
        before = {table: self.db.execute(text(f"SELECT * FROM {table} ORDER BY id")).all() for table in tables}
        self.db.close()
        with self.engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                migration["upgrade"]()
                migration["upgrade"]()
        after = {table: self.db.execute(text(f"SELECT * FROM {table} ORDER BY id")).all() for table in tables}
        self.assertEqual(before, after)
        self.assertEqual(self.db.execute(text("PRAGMA foreign_key_check")).all(), [])
        constraints = inspect(self.engine).get_unique_constraints("words")
        self.assertEqual([(item["name"], item["column_names"]) for item in constraints],
                         [("unique_word_per_module", ["module_id", "word"])])
        self.add_word(2)
        self.add_word(3, user_id=2)


if __name__ == "__main__":
    unittest.main()
