"""add per-language stats to user_languages

Revision ID: a55d653d47e3
Revises: 6186265bd054
Create Date: 2026-04-27 20:37:08.327690
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a55d653d47e3"
down_revision: Union[str, Sequence[str], None] = "6186265bd054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_languages",
        sa.Column("streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "user_languages",
        sa.Column("last_study_date", sa.String(), nullable=True),
    )
    op.add_column(
        "user_languages",
        sa.Column("level", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "user_languages",
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "user_languages",
        sa.Column(
            "freeze_days", sa.Integer(), nullable=False, server_default=sa.text("1")
        ),
    )

    op.execute(
        """
        INSERT INTO user_languages (user_id, language_id, streak, last_study_date, level, xp, freeze_days)
        SELECT
            u.id,
            u.active_language_id,
            u.streak,
            u.last_study_date,
            u.level,
            u.xp,
            u.freeze_days
        FROM users u
        WHERE u.active_language_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM user_languages ul
              WHERE ul.user_id = u.id AND ul.language_id = u.active_language_id
          );
        """
    )

    op.execute(
        """
        UPDATE user_languages
        SET
            streak = (SELECT u.streak FROM users u WHERE u.id = user_languages.user_id),
            last_study_date = (SELECT u.last_study_date FROM users u WHERE u.id = user_languages.user_id),
            level = (SELECT u.level FROM users u WHERE u.id = user_languages.user_id),
            xp = (SELECT u.xp FROM users u WHERE u.id = user_languages.user_id),
            freeze_days = (SELECT u.freeze_days FROM users u WHERE u.id = user_languages.user_id)
        WHERE language_id = (
            SELECT u.active_language_id
            FROM users u
            WHERE u.id = user_languages.user_id
        )
        AND (
            SELECT u.active_language_id
            FROM users u
            WHERE u.id = user_languages.user_id
        ) IS NOT NULL;
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("user_languages") as batch_op:
        batch_op.drop_column("freeze_days")
        batch_op.drop_column("xp")
        batch_op.drop_column("level")
        batch_op.drop_column("last_study_date")
        batch_op.drop_column("streak")
