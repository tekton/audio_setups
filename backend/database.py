"""Postgres persistence for layouts. Used when DATABASE_URL is set."""

import os
from contextlib import contextmanager

from sqlalchemy import JSON, Column, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

Base = declarative_base()


class LayoutRow(Base):
    __tablename__ = "layouts"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False, default="Untitled layout")
    data = Column(JSON, nullable=False, default=dict)  # { "devices": [], "connections": [] }


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            return None
        _engine = create_engine(url, pool_pre_ping=True)
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine()
        if engine is None:
            return None
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionLocal


def init_db():
    """Create tables if they don't exist. Call on app startup when using Postgres."""
    engine = get_engine()
    if engine is not None:
        Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope():
    factory = get_session_factory()
    if factory is None:
        yield None
        return
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
