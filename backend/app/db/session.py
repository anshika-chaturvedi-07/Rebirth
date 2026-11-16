from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    # Named constraints keep migrations working on SQLite (batch mode) and Postgres alike.
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


def utcnow() -> datetime:
    """Naive UTC timestamp. All datetimes are stored as UTC without tzinfo (portable across SQLite and Postgres)."""
    return datetime.now(UTC).replace(tzinfo=None)


def make_engine(url: str):
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    return create_engine(url, **kwargs)


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
