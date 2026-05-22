"""add lesson attempts

Revision ID: cf4e849b2d37
Revises: a55d653d47e3
Create Date: 2026-05-23 00:11:25.400740
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cf4e849b2d37"
down_revision: Union[str, Sequence[str], None] = "a55d653d47e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("module_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("total_tasks", sa.Integer(), nullable=False),
        sa.Column("words_reviewed", sa.Integer(), nullable=False),
        sa.Column("xp_earned", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lesson_attempts_id"),
        "lesson_attempts",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_attempts_id"), table_name="lesson_attempts")
    op.drop_table("lesson_attempts")