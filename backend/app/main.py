from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import tasks, webhooks, knowledge_bases, documents, chat

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KnowHub API",
    description="Enterprise RAG Knowledge Base SaaS",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 现有路由
app.include_router(tasks.router)
app.include_router(webhooks.router)

# RAG知识库路由
app.include_router(knowledge_bases.router)
app.include_router(documents.router)
app.include_router(chat.router)