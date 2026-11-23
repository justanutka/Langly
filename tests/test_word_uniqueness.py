import runpy
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import Mock
from unittest.mock import patch

import requests
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import models, schemas
from backend.routers import words


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "f2c814a6d390_allow_confirmed_word_duplicates.py"


class DictionaryLookupTests(unittest.TestCase):
    def test_wiktionary_requires_a_heading_for_the_requested_language(self):
        cases = [
            ("de", "Brunnen", "== Brunnen ({{Sprache|Deutsch}}) =="),
            ("es", "manzana", "== {{lengua|es}} =="),
            ("pl", "jabłko", "== jabłko ({{język polski}}) =="),
            ("ru", "иду", "= {{-ru-|nocat}} ="),
        ]
        for language, word, heading in cases:
            for content, expected in [(heading, True), (f"=== Example ===\nAn example: {heading}", False)]:
                with self.subTest(language=language, expected=expected):
                    response = Mock()
                    response.json.return_value = {"query": {"pages": [
                        {"ns": 0, "revisions": [{"slots": {"main": {"content": content}}}]}
                    ]}}
                    with patch.object(words.requests, "get", return_value=response) as request:
                        self.assertIs(words.validate_word_exists(word, language), expected)
                    self.assertEqual(request.call_args.args[0], f"https://{language}.wiktionary.org/w/api.php")
                    options = request.call_args.kwargs
                    self.assertEqual(options["headers"]["User-Agent"], words.WIKTIONARY_USER_AGENT)
                    self.assertIn(word, options["params"]["titles"].split("|"))

    def test_wiktionary_tries_german_noun_capitalization(self):
        response = Mock()
        response.json.return_value = {"query": {"pages": [{"ns": 0, "missing": True}]}}
        with patch.object(words.requests, "get", return_value=response) as request:
            self.assertFalse(words.validate_word_exists("BRUNNEN", "de"))
        self.assertEqual(request.call_args.kwargs["params"]["titles"], "BRUNNEN|brunnen|Brunnen")

    def test_wiktionary_unexpected_api_response_is_unavailable(self):
        response = Mock()
        response.json.return_value = {"error": {"code": "maxlag"}}
        with patch.object(words.requests, "get", return_value=response):
            with self.assertRaises(words.DictionaryUnavailable):
                words.validate_word_exists("jabłko", "pl")

    def test_english_missing_word_and_network_error_have_different_outcomes(self):
        response = Mock(status_code=404)
        with patch.object(words.requests, "get", return_value=response):
            self.assertFalse(words.validate_word_exists("unknown", "en"))
        with patch.object(words.requests, "get", side_effect=requests.Timeout):
            with self.assertRaises(words.DictionaryUnavailable):
                words.validate_word_exists("apple", "en")


class WordEntryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        models.Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.db.add(models.Language(id=1, name="English", code="en"))
        self.db.add_all([models.User(id=i, email=f"user{i}@example.test", password_hash="fixture") for i in (1, 2)])
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

    def add_word(self, module_id=1, user_id=1, **changes):
        return words.create_word(
            schemas.WordCreate(**{"language_id": 1, "module_id": module_id, "word": "dog", "translation": "test", **changes}),
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

    def test_duplicate_requires_confirmation_for_any_translation(self):
        self.add_word()
        for translation in ["test", "another meaning"]:
            with self.subTest(translation=translation):
                with self.assertRaises(HTTPException) as result:
                    self.add_word(translation=translation)
                self.assertEqual(result.exception.status_code, 409)
                self.assertEqual(result.exception.detail["warnings"], ["duplicate"])
        self.assertEqual(self.db.query(models.Word).count(), 1)

    def test_confirmed_duplicates_keep_separate_ids_and_review_states(self):
        first = self.add_word()
        second = self.add_word(allow_duplicate=True)
        third = self.add_word(translation="another meaning", allow_duplicate=True)
        self.assertEqual(len({first.id, second.id, third.id}), 3)
        self.assertEqual(self.db.query(models.ReviewState).count(), 3)

    def test_normalized_duplicate_requires_confirmation(self):
        self.add_word(word="café au lait")
        with self.assertRaises(HTTPException) as result:
            self.add_word(word="  CAFE\u0301  au\u00a0lait ")
        self.assertEqual(result.exception.detail["warnings"], ["duplicate"])

    def test_related_phrases_are_not_duplicates(self):
        for entry in ["go", "go to school", "go to sleep"]:
            self.add_word(word=entry)
        self.assertEqual(self.db.query(models.Word).count(), 3)

    def test_single_word_is_checked_even_with_confirmation_flags(self):
        for entry in ["wrongword", "wrongword !", "wrongword-variant", "wrongword.example", "wrongword 123"]:
            with self.subTest(entry=entry), patch.object(words, "validate_word_exists", return_value=False) as validate:
                with self.assertRaises(HTTPException) as result:
                    self.add_word(word=entry, allow_duplicate=True, allow_unverified_phrase=True)
                self.assertEqual(result.exception.status_code, 400)
                self.assertEqual(result.exception.detail["code"], "invalid_word")
                validate.assert_called_once()
        self.assertEqual(self.db.query(models.Word).count(), 0)

    def test_unverified_phrase_requires_confirmation(self):
        with patch.object(words, "validate_word_exists", return_value=False):
            with self.assertRaises(HTTPException) as result:
                self.add_word(word="go to school")
            self.assertEqual(result.exception.status_code, 409)
            self.assertEqual(result.exception.detail["warnings"], ["unverified_phrase"])
            saved = self.add_word(word="  go   to school ", allow_unverified_phrase=True)
            self.assertEqual(saved.word, "go to school")

    def test_dictionary_outage_blocks_single_words_but_allows_confirmed_phrases(self):
        with patch.object(words, "validate_word_exists", side_effect=words.DictionaryUnavailable):
            with self.assertRaises(HTTPException) as result:
                self.add_word(word="apple", allow_unverified_phrase=True)
            self.assertEqual(result.exception.status_code, 503)
            self.assertEqual(result.exception.detail["code"], "dictionary_unavailable")

            with self.assertRaises(HTTPException) as result:
                self.add_word(word="go to school")
            self.assertEqual(result.exception.status_code, 409)
            self.assertEqual(result.exception.detail["warnings"], ["unverified_phrase"])
            self.assertEqual(self.db.query(models.Word).count(), 0)
            self.assertEqual(self.add_word(word="go to school", allow_unverified_phrase=True).word, "go to school")

    def test_dictionary_check_uses_each_study_language(self):
        for language_id, code in enumerate(["pl", "es", "de", "ru"], start=2):
            self.db.add(models.Language(id=language_id, name=code, code=code))
            self.db.add(models.UserLanguage(user_id=1, language_id=language_id))
            self.db.add(models.Folder(id=language_id + 10, name=code, user_id=1, language_id=language_id))
            self.db.flush()
            self.db.add(models.Module(id=language_id + 10, name=code, folder_id=language_id + 10))
        self.db.commit()
        for language_id, code in enumerate(["en", "pl", "es", "de", "ru"], start=1):
            module_id = 1 if language_id == 1 else language_id + 10
            with self.subTest(code=code), patch.object(words, "validate_word_exists", return_value=False) as validate:
                with self.assertRaises(HTTPException):
                    self.add_word(module_id, word="unknown", language_id=language_id, allow_unverified_phrase=True)
                validate.assert_called_once_with("unknown", code)
                validate.reset_mock()
                self.add_word(module_id, word="test phrase", language_id=language_id, allow_unverified_phrase=True)
                validate.assert_called_once_with("test phrase", code)

    def test_duplicate_and_unverified_phrase_require_both_confirmations(self):
        self.add_word(word="go to school")
        with patch.object(words, "validate_word_exists", return_value=False):
            for flags, warnings in [({}, ["duplicate", "unverified_phrase"]), ({"allow_duplicate": True}, ["unverified_phrase"]), ({"allow_unverified_phrase": True}, ["duplicate"])]:
                with self.subTest(flags=flags), self.assertRaises(HTTPException) as result:
                    self.add_word(word="go to school", **flags)
                self.assertEqual(result.exception.detail["warnings"], warnings)
            self.add_word(word="go to school", allow_duplicate=True, allow_unverified_phrase=True)
        self.assertEqual(self.db.query(models.Word).count(), 2)

    def test_empty_values_are_rejected(self):
        for changes in [{"word": "  "}, {"translation": "\t"}]:
            with self.subTest(changes=changes), self.assertRaises(HTTPException) as result:
                self.add_word(**changes)
            self.assertEqual(result.exception.detail["code"], "empty_entry")

    def test_cannot_add_to_foreign_or_nonexistent_module(self):
        for module_id in [0, 3, 999]:
            with self.subTest(module_id=module_id):
                with self.assertRaises(HTTPException) as result:
                    self.add_word(module_id)
                self.assertEqual(result.exception.status_code, 404)
        self.assertEqual(self.db.query(models.Word).count(), 0)

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
        self.assertEqual(constraints, [])
        self.add_word(1, allow_duplicate=True)
        self.db.close()
        with self.assertRaises(RuntimeError):
            with self.engine.begin() as connection:
                with Operations.context(MigrationContext.configure(connection)):
                    migration["downgrade"]()
        self.add_word(2)
        self.add_word(3, user_id=2)


if __name__ == "__main__":
    unittest.main()
