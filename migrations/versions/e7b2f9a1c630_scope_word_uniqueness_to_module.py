"""Scope word uniqueness to a module.

Revision ID: e7b2f9a1c630
Revises: d4a8c2f0b7e1
"""

from alembic import op
import sqlalchemy as sa


revision = "e7b2f9a1c630"
down_revision = "d4a8c2f0b7e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    constraints = sa.inspect(op.get_bind()).get_unique_constraints("words")
    has_global = any(item["name"] == "unique_word_per_language" for item in constraints)
    has_module = any(item["name"] == "unique_word_per_module" for item in constraints)
    if has_global or not has_module:
        with op.batch_alter_table("words") as batch_op:
            if has_global:
                batch_op.drop_constraint("unique_word_per_language", type_="unique")
            if not has_module:
                batch_op.create_unique_constraint("unique_word_per_module", ["module_id", "word"])


def downgrade() -> None:
    # Downgrade fails without deleting data if modules now share the same word.
    with op.batch_alter_table("words") as batch_op:
        batch_op.drop_constraint("unique_word_per_module", type_="unique")
        batch_op.create_unique_constraint("unique_word_per_language", ["language_id", "word"])
