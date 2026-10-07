from sqlalchemy import select

from .models import Comment


def comments_for_post(session, post_id: int, limit: int = 50, offset: int = 0):
    """Live comments under a post, oldest first, for the post page."""
    if not 1 <= limit <= 200:
        raise ValueError("limit must be between 1 and 200")
    if offset < 0:
        raise ValueError("offset must not be negative")
    return session.scalars(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()
