from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from .db import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    published_at = Column(DateTime(timezone=True))
    # Posts are never hard-deleted: deleting a post sets deleted_at.
    deleted_at = Column(DateTime(timezone=True))
