from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.main import create_app


def settings() -> Settings:
    return Settings(
        _env_file=None,
        postgres_db="test",
        postgres_user="test",
        postgres_password="test-secret",
    )


def test_liveness_does_not_probe_database():
    with patch("app.main.check_database") as probe:
        with TestClient(create_app(settings())) as client:
            response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "quantum-job-tracker-api"}
        probe.assert_not_called()


def test_readiness_probes_database():
    with patch("app.main.check_database") as probe:
        with TestClient(create_app(settings())) as client:
            response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ready", "database": "reachable"}
        probe.assert_called_once()


def test_readiness_failure_is_sanitized_and_recovers():
    error = OperationalError("SELECT 1", {}, Exception("test-secret connection failed"))
    with patch("app.main.check_database", side_effect=[error, None]):
        with TestClient(create_app(settings())) as client:
            failed = client.get("/health/ready")
            assert failed.status_code == 503
            assert failed.json() == {"status": "not_ready", "database": "unavailable"}
            assert "test-secret" not in failed.text
            assert client.get("/health/live").status_code == 200
            assert client.get("/health/ready").status_code == 200
