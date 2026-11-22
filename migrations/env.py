from logging.config import fileConfig
from sqlalchemy import engine_from_config, inspect, pool
from alembic import context
from alembic.script import ScriptDirectory

from backend.models import Base  

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata 

# Run migrations in 'offline' mode.
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

# Run migrations in 'online' mode.
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connection = config.attributes.get("connection")
    if connection is not None:
        run_migrations_with_connection(connection)
        return

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        with connection.begin():
            run_migrations_with_connection(connection)


def run_migrations_with_connection(connection):
    if not connection.connection.driver_connection.in_transaction:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        adopt_unversioned_schema(connection)
        context.run_migrations()


def adopt_unversioned_schema(connection):
    migration = context.get_context()
    if migration.opts.get("destination_rev") != "head" or migration.get_current_heads():
        return
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    if "users" not in tables or "auth_sessions" not in tables:
        return
    for table in target_metadata.sorted_tables:
        if table.name not in tables:
            raise RuntimeError(f"Unversioned database is missing table {table.name}.")
        columns = {column["name"] for column in inspector.get_columns(table.name)}
        if columns != set(table.columns.keys()) or inspector.get_pk_constraint(table.name)["constrained_columns"] != ["id"]:
            raise RuntimeError(f"Unrecognized unversioned table {table.name}.")
        links = {(tuple(key["constrained_columns"]), key["referred_table"], tuple(key["referred_columns"]))
                 for key in inspector.get_foreign_keys(table.name)}
        for key in table.foreign_keys:
            if (table.name, key.parent.name) in {("notes", "language_id"), ("users", "interface_language_id")}:
                continue
            if ((key.parent.name,), key.column.table.name, (key.column.name,)) not in links:
                raise RuntimeError(f"Missing reference on {table.name}.{key.parent.name}.")
    if any(index["unique"] for index in inspector.get_indexes("words")):
        raise RuntimeError("Unrecognized unique word index in unversioned database.")
    unique_words = {key["name"]: key["column_names"] for key in inspector.get_unique_constraints("words")}
    if not unique_words:
        revision = "f2c814a6d390"
    elif unique_words == {"unique_word_per_module": ["module_id", "word"]}:
        revision = "9bc983e54f40"
    elif unique_words == {"unique_word_per_language": ["language_id", "word"]}:
        revision = "d4a8c2f0b7e1"
    else:
        raise RuntimeError("Unrecognized word constraints in unversioned database.")
    migration.stamp(ScriptDirectory.from_config(config), revision)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
