"""Add last_study_date field to User model

Revision ID: 308ab02a5d83
Revises: None
Create Date: 2026-03-17 18:50:00
"""

revision = '308ab02a5d83'
down_revision = None  
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from datetime import datetime

def upgrade():
    op.create_table(
        'users_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('streak', sa.Integer(), nullable=False),
        sa.Column('last_study_date', sa.DateTime(), nullable=True, default=datetime.utcnow),  # Новое поле
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('xp', sa.Integer(), nullable=False),
        sa.Column('freeze_days', sa.Integer(), nullable=False),
        sa.Column('active_language_id', sa.Integer(), nullable=True),
        sa.Column('native_language_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['active_language_id'], ['languages.id']),
        sa.ForeignKeyConstraint(['native_language_id'], ['languages.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.execute('''
        INSERT INTO users_new (id, email, password_hash, streak, last_study_date, level, xp, freeze_days, active_language_id, native_language_id)
        SELECT id, email, password_hash, streak, last_study_date, level, xp, freeze_days, active_language_id, native_language_id 
        FROM users
    ''')

    op.drop_table('users')

    op.rename_table('users_new', 'users')

def downgrade():
    pass