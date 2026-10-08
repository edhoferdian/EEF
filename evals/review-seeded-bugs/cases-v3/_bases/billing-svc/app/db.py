from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

engine = create_engine("postgresql+psycopg://billing@db/billing")
Session = sessionmaker(engine)


class Base(DeclarativeBase):
    pass
