"""add mastered_at to words

Revision ID: 5c5c3e656a6a
Revises: a07fa34df0b6
Create Date: 2026-04-17 22:41:33.041669
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5c5c3e656a6a"
down_revision: Union[str, Sequence[str], None] = "a07fa34df0b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("words", sa.Column("mastered_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "mastered_at")