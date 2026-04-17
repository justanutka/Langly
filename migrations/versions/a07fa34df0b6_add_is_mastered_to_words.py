"""add is_mastered to words

Revision ID: a07fa34df0b6
Revises: 5bdbad4e9acc
Create Date: 2026-04-17 21:50:55.819997
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a07fa34df0b6"
down_revision: Union[str, Sequence[str], None] = "5bdbad4e9acc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("words", sa.Column("is_mastered", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "is_mastered")