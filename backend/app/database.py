from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from app.config import Settings

metadata = MetaData()


def make_engine(settings: Settings) -> Engine:
    # No connection at startup: liveness must survive database outages.
    # Fresh probes avoid stale pooled connections and pool exhaustion waits.
    return create_engine(
        settings.database_url,
        poolclass=NullPool,
        connect_args={"connect_timeout": 2, "options": "-c statement_timeout=2000"},
    )


def check_database(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
