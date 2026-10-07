from sqlalchemy import select

from .models import Comment


def comments_by_author(session, author_id: int):
    """Every live comment by one author, for the moderation queue."""
    return session.scalars(
        select(Comment)
        .where(Comment.author_id == author_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.desc())
    ).all()
