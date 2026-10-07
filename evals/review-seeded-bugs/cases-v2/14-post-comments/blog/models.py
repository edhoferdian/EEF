from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text

from .db import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    # Comments are never hard-deleted: deleting a comment sets deleted_at.
    deleted_at = Column(DateTime(timezone=True))
