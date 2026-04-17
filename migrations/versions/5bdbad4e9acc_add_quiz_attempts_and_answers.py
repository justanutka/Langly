from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5bdbad4e9acc'
down_revision: Union[str, Sequence[str], None] = '6327e172f671'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'quiz_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('quiz_type', sa.String(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('total_questions', sa.Integer(), nullable=False),
        sa.Column('xp_earned', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quiz_attempts_id'), 'quiz_attempts', ['id'], unique=False)

    op.create_table(
        'quiz_answers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attempt_id', sa.Integer(), nullable=False),
        sa.Column('word_id', sa.Integer(), nullable=False),
        sa.Column('question_type', sa.String(), nullable=False),
        sa.Column('user_answer', sa.String(), nullable=True),
        sa.Column('correct_answer', sa.String(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['attempt_id'], ['quiz_attempts.id']),
        sa.ForeignKeyConstraint(['word_id'], ['words.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quiz_answers_id'), 'quiz_answers', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_quiz_answers_id'), table_name='quiz_answers')
    op.drop_table('quiz_answers')
    op.drop_index(op.f('ix_quiz_attempts_id'), table_name='quiz_attempts')
    op.drop_table('quiz_attempts')