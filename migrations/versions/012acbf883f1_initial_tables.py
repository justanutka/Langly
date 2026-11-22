from alembic import op
import sqlalchemy as sa


revision = "012acbf883f1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "users" in existing:
        columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("users")}
        if columns != {"id", "email", "password_hash", "streak", "last_study_date", "level",
                       "xp", "freeze_days", "active_language_id", "native_language_id"}:
            raise RuntimeError("Cannot identify the starting revision of the existing users table.")
        return

    op.execute("""CREATE TABLE languages (
        id INTEGER PRIMARY KEY, name VARCHAR NOT NULL UNIQUE, code VARCHAR NOT NULL UNIQUE
    )""")
    op.execute("""CREATE TABLE users (
        id INTEGER PRIMARY KEY, email VARCHAR NOT NULL, password_hash VARCHAR NOT NULL,
        streak INTEGER, last_study_date VARCHAR, level INTEGER, xp INTEGER, freeze_days INTEGER,
        active_language_id INTEGER REFERENCES languages(id),
        native_language_id INTEGER REFERENCES languages(id)
    )""")
    op.execute("""CREATE TABLE user_languages (
        id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id),
        language_id INTEGER REFERENCES languages(id)
    )""")
    op.execute("""CREATE TABLE achievements (
        id INTEGER PRIMARY KEY, name VARCHAR, description VARCHAR, user_id INTEGER REFERENCES users(id)
    )""")
    op.execute("""CREATE TABLE folders (
        id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, user_id INTEGER REFERENCES users(id),
        language_id INTEGER REFERENCES languages(id), created_at DATETIME
    )""")
    op.execute("""CREATE TABLE modules (
        id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, folder_id INTEGER REFERENCES folders(id),
        created_at DATETIME
    )""")
    op.execute("""CREATE TABLE words (
        id INTEGER PRIMARY KEY, word VARCHAR NOT NULL, translation VARCHAR NOT NULL,
        example VARCHAR, language_id INTEGER REFERENCES languages(id), module_id INTEGER REFERENCES modules(id)
    )""")
    op.execute("""CREATE TABLE review_states (
        id INTEGER PRIMARY KEY, word_id INTEGER REFERENCES words(id), repetition INTEGER,
        interval INTEGER, ef VARCHAR, next_review VARCHAR
    )""")
    op.execute("""CREATE TABLE password_reset_codes (
        id INTEGER PRIMARY KEY, email VARCHAR NOT NULL, code_hash VARCHAR NOT NULL,
        new_password_hash VARCHAR NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME,
        created_at DATETIME
    )""")
    op.create_index("ix_password_reset_codes_email", "password_reset_codes", ["email"])
    op.execute("""INSERT INTO languages (id, name, code) VALUES
        (1, 'English', 'en'), (2, 'Polish', 'pl'), (3, 'Spanish', 'es'),
        (4, 'German', 'de'), (5, 'Russian', 'ru')
    """)


def downgrade():
    raise RuntimeError("The initial application tables contain user data and must be retained.")
