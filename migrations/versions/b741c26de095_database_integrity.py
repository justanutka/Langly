from alembic import op
import sqlalchemy as sa


revision = "b741c26de095"
down_revision = "f2c814a6d390"
branch_labels = None
depends_on = None

NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}
DEPENDENCIES = {
    "modules": {"folder_id": "folders"},
    "words": {"module_id": "modules"},
    "review_states": {"word_id": "words"},
    "quiz_attempts": {"module_id": "modules"},
    "lesson_attempts": {"module_id": "modules"},
    "quiz_answers": {"attempt_id": "quiz_attempts", "word_id": "words"},
}


def replace_key(batch, table, column, parent, ondelete=None):
    name = f"fk_{table}_{column}_{parent}"
    for key in sa.inspect(op.get_bind()).get_foreign_keys(table):
        if key["constrained_columns"] == [column]:
            batch.drop_constraint(key["name"] or name, type_="foreignkey")
    batch.create_foreign_key(name, parent, [column], ["id"], ondelete=ondelete)


def configure_dependencies(cascade):
    for table, keys in DEPENDENCIES.items():
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            for column, parent in keys.items():
                replace_key(batch, table, column, parent, "CASCADE" if cascade else None)
            if table in ("modules", "review_states"):
                batch.alter_column(next(iter(keys)), existing_type=sa.Integer(), nullable=not cascade)


def check_links(db):
    error = db.exec_driver_sql("PRAGMA foreign_key_check").first()
    if error:
        raise RuntimeError(f"Invalid reference in {error[0]}, row {error[1]}, to {error[2]}.")


def upgrade():
    db = op.get_bind()
    if db.exec_driver_sql("PRAGMA foreign_keys").scalar():
        raise RuntimeError("Use the dedicated Alembic connection to rebuild SQLite tables.")
    check_links(db)
    mixed_answer = db.exec_driver_sql("""
        SELECT a.id FROM quiz_answers a
        JOIN words w ON w.id = a.word_id
        JOIN quiz_attempts q ON q.id = a.attempt_id
        WHERE w.module_id IS NOT q.module_id LIMIT 1
    """).first()
    if mixed_answer:
        raise RuntimeError(f"Verify the module for quiz answer {mixed_answer[0]} before migrating.")
    seen = {}
    updates = []
    for user_id, email in db.exec_driver_sql("SELECT id, email FROM users"):
        normalized = (email or "").strip().lower()
        if not normalized:
            raise RuntimeError(f"Missing email on account {user_id}.")
        if normalized in seen:
            raise RuntimeError(f"Resolve duplicate emails on accounts {seen[normalized]} and {user_id}.")
        seen[normalized] = user_id
        if email != normalized:
            updates.append((normalized, user_id))
    if updates:
        db.exec_driver_sql("UPDATE users SET email = ? WHERE id = ?", updates)

    for table, column in (("users", "interface_language_id"), ("notes", "language_id")):
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            replace_key(batch, table, column, "languages")
            if table == "users":
                batch.alter_column("email", type_=sa.String(collation="NOCASE"), nullable=False)
                batch.alter_column("password_hash", existing_type=sa.String(), nullable=False)
                batch.create_check_constraint("ck_users_email_trimmed", "email = trim(email, char(9,10,11,12,13,32))")

    indexes = sa.inspect(db).get_indexes("users")
    if any(index["name"] == "ix_users_email" for index in indexes):
        op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    configure_dependencies(True)

    for name, event in (("insert", "INSERT"), ("update", "UPDATE OF module_id")):
        op.execute(f"""CREATE TRIGGER require_word_module_{name} BEFORE {event} ON words
            WHEN NEW.module_id IS NULL
            BEGIN SELECT RAISE(ABORT, 'A word must belong to a module'); END""")
    check_links(db)


def downgrade():
    op.execute("DROP TRIGGER require_word_module_insert")
    op.execute("DROP TRIGGER require_word_module_update")
    configure_dependencies(False)
    op.drop_index("ix_users_email", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("ck_users_email_trimmed", type_="check")
        batch.alter_column("email", type_=sa.String(), nullable=False)
    check_links(op.get_bind())
