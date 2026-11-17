from alembic import op
import sqlalchemy as sa


revision = "f2c814a6d390"
down_revision = "9bc983e54f40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    constraints = sa.inspect(op.get_bind()).get_unique_constraints("words")
    if any(item["name"] == "unique_word_per_module" for item in constraints):
        with op.batch_alter_table("words") as batch_op:
            batch_op.drop_constraint("unique_word_per_module", type_="unique")


def downgrade() -> None:
    duplicate = op.get_bind().execute(sa.text(
        "SELECT 1 FROM words WHERE module_id IS NOT NULL "
        "GROUP BY module_id, word HAVING COUNT(*) > 1 LIMIT 1"
    )).first()
    if duplicate:
        raise RuntimeError("Cannot restore word uniqueness while duplicate entries exist.")
    constraints = sa.inspect(op.get_bind()).get_unique_constraints("words")
    if not any(item["name"] == "unique_word_per_module" for item in constraints):
        with op.batch_alter_table("words") as batch_op:
            batch_op.create_unique_constraint("unique_word_per_module", ["module_id", "word"])
