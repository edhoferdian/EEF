from sqlalchemy import select

from .models import Post


def posts_by_author(session, author_id: int, limit: int = 20):
    """Published posts for an author's public profile page, newest first."""
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")
    return session.scalars(
        select(Post)
        .where(Post.author_id == author_id, Post.published_at.is_not(None))
        .order_by(Post.published_at.desc())
        .limit(limit)
    ).all()
