"""add description and emoji to folder

Revision ID: 6327e172f671
Revises: 308ab02a5d83
Create Date: 2026-04-06 15:22:47.852590
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6327e172f671'
down_revision: Union[str, Sequence[str], None] = '308ab02a5d83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('folders', sa.Column('description', sa.String(), nullable=True))
    op.add_column('folders', sa.Column('emoji', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('folders', 'emoji')
    op.drop_column('folders', 'description')