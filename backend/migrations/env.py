import sys
from pathlib import Path

from alembic import context

# Avoid legacy Alembic's whitespace splitting of paths such as Quantum tracker.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.database import make_engine, metadata
from app import models  # Register tables for Alembic autogeneration.

if context.is_offline_mode():
    context.configure(
        url=Settings().database_url,
        target_metadata=metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    # Test harnesses can supply an isolated PostgreSQL schema/transaction.
    context.configure(connection=context.config.attributes["connection"], target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(Settings())
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()
