"""add interface language to users

Revision ID: c91f4b7428b1
Revises: cf4e849b2d37
Create Date: 2026-05-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c91f4b7428b1"
down_revision: Union[str, Sequence[str], None] = "cf4e849b2d37"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "interface_language_id",
                sa.Integer(),
                sa.ForeignKey("languages.id"),
                nullable=True,
            )
        )
    op.execute(
        """
        UPDATE users
        SET interface_language_id = native_language_id
        WHERE interface_language_id IS NULL
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("interface_language_id")
