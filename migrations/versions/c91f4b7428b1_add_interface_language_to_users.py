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
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    # Older app versions could already add this column at startup.
    if "interface_language_id" not in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "interface_language_id",
                    sa.Integer(),
                    sa.ForeignKey("languages.id", name="fk_users_interface_language_id"),
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
