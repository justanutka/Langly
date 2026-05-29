"""add language to notes

Revision ID: d4a8c2f0b7e1
Revises: c91f4b7428b1
Create Date: 2026-05-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a8c2f0b7e1"
down_revision: Union[str, Sequence[str], None] = "c91f4b7428b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("notes") as batch_op:
        batch_op.add_column(
            sa.Column(
                "language_id",
                sa.Integer(),
                sa.ForeignKey("languages.id"),
                nullable=True,
            )
        )

    op.execute(
        """
        UPDATE notes
        SET language_id = COALESCE(
            (SELECT id FROM languages WHERE code = 'en' LIMIT 1),
            (
                SELECT COALESCE(users.active_language_id, users.native_language_id)
                FROM users
                WHERE users.id = notes.user_id
            )
        )
        WHERE language_id IS NULL
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("notes") as batch_op:
        batch_op.drop_column("language_id")
