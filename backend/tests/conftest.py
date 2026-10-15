"""PostgreSQL integration fixtures use disposable schemas, never truncate app data."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool


@pytest.fixture
def postgres_engine():
    url = os.environ.get("QUANTUM_JOB_TRACKER_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set QUANTUM_JOB_TRACKER_TEST_DATABASE_URL to run real PostgreSQL tests")
    if not url.startswith("postgresql+psycopg://"):
        pytest.fail("Integration tests require a postgresql+psycopg URL, never SQLite")
    admin = create_engine(url, poolclass=NullPool)
    schema = "quantum_job_tracker_test_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, poolclass=NullPool, connect_args={
        "connect_timeout": 3,
        "options": f"-csearch_path={schema} -cstatement_timeout=10000",
    })
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def db(postgres_engine):
    with postgres_engine.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()
