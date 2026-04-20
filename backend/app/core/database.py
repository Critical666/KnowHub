# SQLAlchemy 1.4+ 风格构建数据库连接、会话工厂以及依赖注入生成器的典型写法
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

'''
    SQLite 默认只允许创建连接的线程使用该连接（check_same_thread=True）。
    但在 Web 应用中（如 FastAPI），请求可能由不同线程处理，若不关闭此检查，访问 SQLite 时会抛出 ProgrammingError
'''
connect_args = {"check_same_thread":False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()