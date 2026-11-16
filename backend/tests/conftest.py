import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from app.db.session import Base, get_db
from app.main import app


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")  # e.g. postgresql+psycopg://... in CI; default: in-memory SQLite


@pytest.fixture()
def db_session():
    if TEST_DATABASE_URL:
        engine = create_engine(TEST_DATABASE_URL)
        Base.metadata.drop_all(engine)  # start clean even if a previous run was interrupted
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield TestingSession
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def override():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(client_factory, role: str, email: str) -> TestClient:
    """Register a user on its own client (each client keeps its own session cookie)."""
    c = client_factory()
    res = c.post("/api/auth/register", json={
        "role": role, "name": f"Test {role}", "email": email, "city": "Bengaluru", "password": "password123",
    })
    assert res.status_code == 201, res.text
    return c


@pytest.fixture()
def new_client(client):
    """Factory for extra clients sharing the same test database."""
    return lambda: TestClient(app)
