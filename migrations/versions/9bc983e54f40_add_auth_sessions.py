"""Add renewable login sessions."""

from alembic import op
import sqlalchemy as sa


revision = "9bc983e54f40"
down_revision = "e7b2f9a1c630"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The application also creates new tables at startup.
    if sa.inspect(op.get_bind()).has_table("auth_sessions"):
        return
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("renewal_hash", sa.String(), nullable=False),
        sa.Column("idle_until", sa.DateTime(), nullable=False),
        sa.Column("absolute_until", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_idle_until", "auth_sessions", ["idle_until"])


def downgrade() -> None:
    op.drop_table("auth_sessions")
