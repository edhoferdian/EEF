from sqlalchemy import select

from .models import Post


def recent_posts(session, limit=20):
    """Newest published posts for the home page."""
    return session.scalars(
        select(Post)
        .where(Post.deleted_at.is_(None), Post.published_at.is_not(None))
        .order_by(Post.published_at.desc())
        .limit(limit)
    ).all()
