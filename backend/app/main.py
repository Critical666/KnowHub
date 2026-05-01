from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import knowledge_bases, documents, chat

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RAG Knowledge Base API",
    description="Enterprise RAG Knowledge Base System",
    version="1.0.0"
)

allow_origins=[
    "https://critical666.github.io",
    "https://critical666.github.io/KnowHub",
    "https://critical666.github.io/KnowHub/#/",
    "https://critical666.github.io/KnowHub/#/knowledge",
    "http://localhost:5173",
    "http://localhost:3000"
]

# RAG知识库路由
app.include_router(knowledge_bases.router)
app.include_router(documents.router)
app.include_router(chat.router)