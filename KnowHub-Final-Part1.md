# KnowHub - 企业RAG知识库SaaS 完整开发文档（Part 1：Phase 1-3）

## 文档说明

本文档是 KnowHub 项目的完整开发指南，采用**从大到小**的思维逻辑组织。

**技术方案**：使用 **Milvus Lite**（轻量级向量数据库），适合低配置云服务器部署。

**核心流程**：
```
文档上传 → 解析分段 → 向量化 → 存储 → 用户提问 → 向量检索 → LLM生成答案
```

---

## 第一章：系统整体规划

### 1.1 产品目标

| 功能 | 说明 |
|------|------|
| **知识库管理** | 创建多个知识库（产品手册、FAQ、技术文档） |
| **文档上传** | 支持PDF、Word、Markdown、TXT等格式 |
| **智能问答** | AI基于知识库内容回答问题 |
| **多租户隔离** | 企业间数据完全隔离 |

### 1.2 系统架构

```
前端(React) → API(FastAPI) → 业务层 → RAG引擎 → 存储层
                                    ↓
                              Milvus Lite(向量)
                              SQLite(元数据)
                              MinIO(文件)
```

### 1.3 技术栈选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | React + TypeScript | 类型安全、生态成熟 |
| 后端 | Python + FastAPI | 异步高性能、AI生态丰富 |
| 向量数据库 | **Milvus Lite** | 轻量、纯Python、无需Docker |
| Embedding | BGE-M3 | 中文效果好、开源免费 |
| LLM | Kimi K2.5 | 中文能力强、API稳定 |
| 对象存储 | MinIO | 兼容S3、易于部署 |
| 任务队列 | Celery + Redis | 异步处理文档 |

### 1.4 开发路线图

| 阶段 | 任务 | 时间 |
|------|------|------|
| Phase 1 | 基础环境搭建 | 1天 |
| Phase 2 | 知识库管理功能 | 1天 |
| Phase 3 | 文档上传与存储 | 1天 |
| Phase 4 | 文档解析与向量化 | 2天 |
| Phase 5 | RAG问答功能 | 2天 |
| Phase 6 | 前端界面开发 | 2天 |
| Phase 7 | 集成测试与优化 | 1天 |

---

## 第二章：Phase 1 - 基础环境搭建

### 2.1 目标

搭建开发环境，部署依赖服务（Redis、MinIO），完成数据库模型设计，集成Milvus Lite。

### 2.2 交付物

- [ ] `docker-compose.yml` - 仅Redis+MinIO
- [ ] `backend/pyproject.toml` - Python依赖
- [ ] `backend/.env` - 环境变量
- [ ] `backend/app/core/config.py` - 核心配置
- [ ] `backend/app/core/database.py` - 数据库连接
- [ ] `backend/app/services/rag/vector_store.py` - Milvus Lite服务
- [ ] `backend/app/models/` - 数据库模型

### 2.3 实现步骤

#### 步骤1：Docker Compose配置

**文件**：`docker-compose.yml`

```yaml
version: '3.8'

services:
  # Redis - Celery消息队列
  redis:
    container_name: knowhub-redis
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./volumes/redis:/data
    restart: unless-stopped

  # MinIO - 对象存储（文档文件）
  minio:
    container_name: knowhub-minio
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - ./volumes/minio:/data
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
```

**启动命令**：
```bash
cd /root/B2B-SaaS
mkdir -p volumes/{redis,minio}
docker-compose up -d
```

#### 步骤2：Python依赖配置

**文件**：`backend/pyproject.toml`

```toml
[project]
name = "knowhub-backend"
version = "0.1.0"
description = "KnowHub - Enterprise RAG Knowledge Base SaaS"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.135.3",
    "uvicorn>=0.42.0",
    "clerk-backend-api>=5.0.6",
    "pyjwt>=2.12.1",
    "sqlalchemy>=2.0.48",
    "python-dotenv>=1.2.2",
    "pydantic-settings>=2.0.0",
    "langchain>=0.3.0",
    "milvus-lite>=2.4.0",
    "pymilvus>=2.4.0",
    "sentence-transformers>=3.0.0",
    "openai>=1.0.0",
    "celery>=5.4.0",
    "redis>=5.0.0",
    "minio>=7.2.0",
    "python-multipart>=0.0.9",
    "sse-starlette>=2.1.0",
    "pypdf>=5.0.0",
    "python-docx>=1.1.0",
    "markdown>=3.7.0",
]
```

#### 步骤3：环境变量配置

**文件**：`backend/.env`

```bash
# Clerk 配置
CLERK_SECRET_KEY=sk_xxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_xxxxxxxxxx
CLERK_JWKS_URL=xxxxxxxxxx
CLEAK_WEBHOOK_SECRET=xxxxxxxxxx

# 数据库配置
DATABASE_URL=sqlite:///./taskboard.db

# 前端地址配置
FRONTEND_URL=http://localhost:5173

# Milvus Lite配置
MILVUS_LITE_PATH=./milvus_data/knowhub.db
MILVUS_COLLECTION_PREFIX=kb_

# kimi配置
KIMI_API_KEY=sk-xxxxxxxxxx
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5

# Redis配置
REDIS_URL=redis://localhost:6379/0

# MinIO对象存储配置
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=rag-documents
MINIO_SECURE=false

# BGE-M3 Embedding模型
# 首次运行时，会自动下载模型到本地存储。
BGE_MODEL_PATH=BAAI/bge-m3
EMBEDDING_DIMENSION=1024

# 文档处理配置
DOCUMENT_CHUNK_SIZE=500        # 每个文本块的大小（字符数）
DOCUMENT_CHUNK_OVERLAP=50      # 块之间的重叠大小
MAX_FILE_SIZE=52428800         # 50MB (字节)

# RAG检索配置
RETRIEVAL_TOP_K=5              # 检索返回的最相关片段数
RETRIEVAL_SCORE_THRESHOLD=0.7  # 相似度阈值
```

#### 步骤4：核心配置类

**文件**：`backend/app/core/config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 现有配置
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    CLERK_JWKS_URL: str
    CLEAK_WEBHOOK_SECRET: str
    FRONTEND_URL: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///./knowhub.db"
    
    # ========== 关键变更：Milvus Lite配置 ==========
    # Milvus Lite使用本地文件路径，而不是host/port
    MILVUS_LITE_PATH: str = "./milvus_data/knowhub.db"
    MILVUS_COLLECTION_PREFIX: str = "kb_"
    
    # Kimi LLM配置
    KIMI_API_KEY: str
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "kimi-k2.5"
    
    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MinIO配置
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "rag-documents"
    MINIO_SECURE: bool = False
    
    # BGE配置
    BGE_MODEL_PATH: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024
    
    # 文档处理配置
    DOCUMENT_CHUNK_SIZE: int = 500
    DOCUMENT_CHUNK_OVERLAP: int = 50
    MAX_FILE_SIZE: int = 52428800
    
    # 检索配置
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_SCORE_THRESHOLD: float = 0.7
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
```

#### 步骤5：数据库连接

**文件**：`backend/app/core/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 步骤6：Milvus Lite向量存储服务

**文件**：`backend/app/services/rag/vector_store.py`

```python
from milvus_lite import MilvusClient
from typing import List, Dict, Optional, Any
import os


class MilvusVectorStore:
    def __init__(self, db_path: str = "./milvus_data/knowhub.db", dim: int = 1024):
        self.db_path = db_path
        self.dim = dim
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.client = MilvusClient(db_path)
    
    def _get_collection_name(self, kb_id: str) -> str:
        return f"kb_{kb_id}"
    
    def create_collection(self, kb_id: str) -> bool:
        collection_name = self._get_collection_name(kb_id)
        if self.client.has_collection(collection_name):
            return True
        self.client.create_collection(
            collection_name=collection_name,
            dimension=self.dim,
            metric_type="COSINE",
            primary_field="id",
            vector_field="embedding"
        )
        return True
    
    def insert_chunks(self, kb_id: str, chunks: List[Dict[str, Any]]) -> None:
        if not chunks:
            return
        collection_name = self._get_collection_name(kb_id)
        if not self.client.has_collection(collection_name):
            self.create_collection(kb_id)
        data = []
        for chunk in chunks:
            data.append({
                "id": chunk["id"],
                "doc_id": chunk["doc_id"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "metadata": chunk.get("metadata", {}),
                "embedding": chunk["embedding"]
            })
        self.client.insert(collection_name, data)
    
    def search(self, kb_id: str, query_embedding: List[float], top_k: int = 5,
               score_threshold: float = 0.0, doc_ids: Optional[List[str]] = None) -> List[Dict]:
        collection_name = self._get_collection_name(kb_id)
        if not self.client.has_collection(collection_name):
            return []
        filter_expr = None
        if doc_ids:
            doc_id_list = ", ".join([f'"{doc_id}"' for doc_id in doc_ids])
            filter_expr = f"doc_id in [{doc_id_list}]"
        results = self.client.search(
            collection_name=collection_name,
            data=[query_embedding],
            limit=top_k,
            output_fields=["doc_id", "content", "metadata", "chunk_index"],
            filter=filter_expr
        )
        hits = []
        for result in results[0]:
            similarity = 1 - result["distance"]
            if score_threshold <= 0 or similarity >= score_threshold:
                hits.append({
                    "id": result["id"],
                    "doc_id": result["doc_id"],
                    "content": result["content"],
                    "metadata": result["metadata"],
                    "chunk_index": result["chunk_index"],
                    "score": similarity
                })
        return hits
    
    def delete_by_doc_id(self, kb_id: str, doc_id: str) -> None:
        collection_name = self._get_collection_name(kb_id)
        if self.client.has_collection(collection_name):
            self.client.delete(collection_name, filter=f"doc_id == '{doc_id}'")
    
    def delete_collection(self, kb_id: str) -> None:
        collection_name = self._get_collection_name(kb_id)
        if self.client.has_collection(collection_name):
            self.client.drop_collection(collection_name)
```

#### 步骤7：数据库模型

**文件**：`backend/app/models/knowledge_base.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum, Integer
import enum
from app.core.database import Base


class KBStatus(str, enum.Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    DELETED = "deleted"


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    org_id = Column(String(255), nullable=False, index=True)
    created_by = Column(String(255), nullable=False)
    status = Column(Enum(KBStatus), default=KBStatus.ACTIVE)
    document_count = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**文件**：`backend/app/models/document.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum, Integer, ForeignKey
import enum
from app.core.database import Base


class DocStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    kb_id = Column(String(64), ForeignKey("knowledge_bases.id"), nullable=False, index=True)
    org_id = Column(String(255), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    status = Column(Enum(DocStatus), default=DocStatus.PENDING)
    chunk_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**文件**：`backend/app/models/chat.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey, JSON
import enum
from app.core.database import Base


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    kb_id = Column(String(64), ForeignKey("knowledge_bases.id"), nullable=False, index=True)
    org_id = Column(String(255), nullable=False, index=True)
    created_by = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**文件**：`backend/app/models/__init__.py`

```python
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.models.document import Document, DocStatus
from app.models.chat import ChatSession, ChatMessage, MessageRole

__all__ = [
    "KnowledgeBase", "KBStatus",
    "Document", "DocStatus",
    "ChatSession", "ChatMessage", "MessageRole",
]
```

### 2.4 Phase 1 验收

**验收命令**：
```bash
cd /root/B2B-SaaS
docker-compose up -d
cd backend
uv pip install -e ".[dev]"
python -c "from milvus_lite import MilvusClient; print('OK')"
python -c "from app.core.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

**Phase 1 完成后的项目结构**：
```
/root/B2B-SaaS/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── knowledge_base.py
│   │   │   ├── document.py
│   │   │   ├── chat.py
│   │   │   └── __init__.py
│   │   └── services/
│   │       └── rag/
│   │           └── vector_store.py
│   ├── pyproject.toml
│   └── .env
└── volumes/
    ├── redis/
    └── minio/
```

---

## 第三章：Phase 2 - 知识库管理功能

### 3.1 目标

实现知识库的增删改查功能，包括创建知识库、获取列表、更新信息、删除知识库。

### 3.2 交付物

- [ ] `backend/app/schemas/knowledge_base.py` - Pydantic模型
- [ ] `backend/app/api/knowledge_bases.py` - 知识库API路由
- [ ] 更新 `backend/app/main.py` - 注册路由

### 3.3 实现步骤

#### 步骤1：Pydantic模型定义

**文件**：`backend/app/schemas/knowledge_base.py`

```python
"""知识库Pydantic模型"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    """创建知识库请求模型"""
    name: str = Field(..., min_length=1, max_length=255, description="知识库名称")
    description: Optional[str] = Field(None, max_length=1000, description="知识库描述")


class KnowledgeBaseUpdate(BaseModel):
    """更新知识库请求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="知识库名称")
    description: Optional[str] = Field(None, max_length=1000, description="知识库描述")


class KnowledgeBaseResponse(BaseModel):
    """知识库响应模型"""
    id: str
    name: str
    description: Optional[str]
    org_id: str
    created_by: str
    status: str
    document_count: int
    total_chunks: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeBaseListResponse(BaseModel):
    """知识库列表响应模型"""
    items: list[KnowledgeBaseResponse]
    total: int
```

#### 步骤2：API路由实现

**文件**：`backend/app/api/knowledge_bases.py`

```python
"""知识库管理API"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import AuthUser, get_current_user
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate, 
    KnowledgeBaseUpdate, 
    KnowledgeBaseResponse,
    KnowledgeBaseListResponse
)
from app.services.vector_store import MilvusVectorStore
from app.core.config import settings

router = APIRouter(prefix="/api/v1/knowledge-bases", tags=["knowledge-bases"])


@router.get("", response_model=KnowledgeBaseListResponse)
def list_knowledge_bases(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前组织的知识库列表"""
    kbs = db.query(KnowledgeBase).filter(
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).order_by(KnowledgeBase.created_at.desc()).all()
    
    return KnowledgeBaseListResponse(
        items=[kb.to_dict() for kb in kbs],
        total=len(kbs)
    )


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    data: KnowledgeBaseCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新知识库"""
    kb = KnowledgeBase(
        name=data.name,
        description=data.description,
        org_id=user.org_id,
        created_by=user.user_id,
        status=KBStatus.ACTIVE
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    
    # 创建对应的Milvus Collection
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.create_collection(kb.id)
    except Exception as e:
        db.delete(kb)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create vector collection: {str(e)}"
        )
    
    return kb.to_dict()


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取知识库详情"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    return kb.to_dict()


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    kb_id: str,
    data: KnowledgeBaseUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新知识库信息"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    if data.name is not None:
        kb.name = data.name
    if data.description is not None:
        kb.description = data.description
    
    db.commit()
    db.refresh(kb)
    
    return kb.to_dict()


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除知识库（软删除），同时删除关联的向量数据"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    # 软删除
    kb.status = KBStatus.DELETED
    db.commit()
    
    # 删除向量存储中的Collection
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.delete_collection(kb_id)
    except Exception as e:
        print(f"Warning: Failed to delete vector collection: {e}")
    
    return None
```

#### 步骤3：更新主入口

**文件**：`backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import tasks, webhooks, knowledge_bases, documents

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
```

### 3.4 Phase 2 验收

**测试命令**：
```bash
# 启动服务
cd /root/B2B-SaaS/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 测试API（需要Clerk认证token）
# 创建知识库
curl -X POST http://localhost:8000/api/v1/knowledge-bases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "产品手册", "description": "产品使用说明文档"}'

# 获取列表
curl http://localhost:8000/api/v1/knowledge-bases \
  -H "Authorization: Bearer <token>"
```

---

## 第四章：Phase 3 - 文档上传与存储

### 4.1 目标

实现文档上传功能，支持多格式文件（PDF、Word、Markdown、TXT），使用MinIO进行对象存储。

### 4.2 交付物

- [ ] `backend/app/schemas/document.py` - Pydantic模型
- [ ] `backend/app/services/storage/minio_client.py` - MinIO客户端
- [ ] `backend/app/api/documents.py` - 文档API路由

### 4.3 实现步骤

#### 步骤1：Pydantic模型定义

**文件**：`backend/app/schemas/document.py`

```python
"""文档Pydantic模型"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    """文档上传响应模型"""
    id: str
    filename: str
    file_size: int
    file_type: str
    status: str
    message: str = "Document upload successful, processing queued"


class DocumentResponse(BaseModel):
    """文档响应模型"""
    id: str
    kb_id: str
    filename: str
    file_size: int
    file_type: str
    status: str
    chunk_count: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """文档列表响应模型"""
    items: list[DocumentResponse]
    total: int
```

#### 步骤2：MinIO存储服务

**文件**：`backend/app/services/storage/minio_client.py`

```python
"""MinIO对象存储服务"""
from minio import Minio
from minio.error import S3Error
from typing import BinaryIO
import logging

logger = logging.getLogger(__name__)


class MinioStorageService:
    """MinIO存储服务封装"""
    
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False
    ):
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
        self.bucket = bucket
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """确保存储桶存在"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to check/create bucket: {e}")
            raise
    
    def upload_file(
        self,
        object_name: str,
        file_data: BinaryIO,
        content_type: str = "application/octet-stream",
        file_size: int = None
    ) -> str:
        """上传文件到MinIO"""
        if file_size is None:
            file_data.seek(0, 2)
            file_size = file_data.tell()
            file_data.seek(0)
        
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=file_data,
            length=file_size,
            content_type=content_type
        )
        logger.info(f"Uploaded file: {object_name}")
        return object_name
    
    def download_file(self, object_name: str, file_path: str) -> None:
        """下载文件到本地路径"""
        self.client.fget_object(self.bucket, object_name, file_path)
        logger.info(f"Downloaded file: {object_name} -> {file_path}")
    
    def delete_file(self, object_name: str) -> None:
        """删除文件"""
        self.client.remove_object(self.bucket, object_name)
        logger.info(f"Deleted file: {object_name}")
    
    def get_presigned_url(self, object_name: str, expires: int = 3600) -> str:
        """获取预签名URL"""
        return self.client.presigned_get_object(self.bucket, object_name, expires)
    
    def generate_object_name(self, org_id: str, kb_id: str, doc_id: str, filename: str) -> str:
        """生成对象存储路径: org_id/kb_id/doc_id/filename"""
        return f"{org_id}/{kb_id}/{doc_id}/{filename}"
```

#### 步骤3：文档API路由

**文件**：`backend/app/api/documents.py`

```python
"""文档管理API"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid

from app.core.database import get_db
from app.core.auth import AuthUser, get_current_user
from app.core.config import settings
from app.models.document import Document, DocStatus
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentResponse,
    DocumentListResponse
)
from app.services.storage.minio_client import MinioStorageService

router = APIRouter(prefix="/api/v1/knowledge-bases/{kb_id}/documents", tags=["documents"])

# 支持的文件类型
SUPPORTED_FILE_TYPES = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
}


def get_file_extension(filename: str) -> str:
    """获取文件扩展名"""
    return os.path.splitext(filename)[1].lower()


def validate_file(file: UploadFile) -> tuple[str, str]:
    """验证文件类型和大小"""
    ext = get_file_extension(file.filename)
    
    if ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}"
        )
    
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    return ext, SUPPORTED_FILE_TYPES[ext]


@router.get("", response_model=DocumentListResponse)
def list_documents(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取知识库的文档列表"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    docs = db.query(Document).filter(
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).order_by(Document.created_at.desc()).all()
    
    return DocumentListResponse(
        items=[doc.to_dict() for doc in docs],
        total=len(docs)
    )


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传文档到知识库"""
    # 验证知识库
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    # 验证文件
    ext, content_type = validate_file(file)
    
    # 创建文档记录
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        kb_id=kb_id,
        org_id=user.org_id,
        filename=file.filename,
        file_size=0,
        file_type=ext,
        storage_path="",
        status=DocStatus.PENDING
    )
    
    # 上传到MinIO
    storage = MinioStorageService(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        bucket=settings.MINIO_BUCKET,
        secure=settings.MINIO_SECURE
    )
    
    object_name = storage.generate_object_name(
        org_id=user.org_id,
        kb_id=kb_id,
        doc_id=doc_id,
        filename=file.filename
    )
    
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        storage.upload_file(
            object_name=object_name,
            file_data=file.file,
            content_type=content_type,
            file_size=file_size
        )
        
        doc.file_size = file_size
        doc.storage_path = object_name
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        return DocumentUploadResponse(
            id=doc_id,
            filename=file.filename,
            file_size=file_size,
            file_type=ext,
            status=DocStatus.PENDING
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    kb_id: str,
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档详情"""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return doc.to_dict()


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    kb_id: str,
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除文档，同时删除MinIO文件和向量数据"""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # 删除MinIO文件
    try:
        storage = MinioStorageService(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET,
            secure=settings.MINIO_SECURE
        )
        storage.delete_file(doc.storage_path)
    except Exception as e:
        print(f"Warning: Failed to delete file from storage: {e}")
    
    # 删除向量数据
    try:
        from app.services.vector_store import MilvusVectorStore
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.delete_by_doc_id(kb_id, doc_id)
    except Exception as e:
        print(f"Warning: Failed to delete vectors: {e}")
    
    # 删除数据库记录
    db.delete(doc)
    
    # 更新知识库计数
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb:
        kb.document_count = max(0, kb.document_count - 1)
        kb.total_chunks = max(0, kb.total_chunks - doc.chunk_count)
    
    db.commit()
    
    return None
```

### 4.4 Phase 3 验收

**测试命令**：
```bash
# 上传文档
curl -X POST http://localhost:8000/api/v1/knowledge-bases/{kb_id}/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf"

# 获取文档列表
curl http://localhost:8000/api/v1/knowledge-bases/{kb_id}/documents \
  -H "Authorization: Bearer <token>"
```

**Phase 3 完成后的项目结构**：
```
/root/B2B-SaaS/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── knowledge_bases.py  # 新增
│   │   │   ├── documents.py        # 新增
│   │   │   ├── tasks.py
│   │   │   └── webhooks.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── knowledge_base.py
│   │   │   ├── document.py
│   │   │   ├── chat.py
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── knowledge_base.py   # 新增
│   │   │   └── document.py         # 新增
│   │   ├── services/
│   │   │   ├── vector_store.py
│   │   │   └── storage/
│   │   │       └── minio_client.py # 新增
│   │   └── main.py
│   ├── pyproject.toml
│   └── .env
└── volumes/
    ├── redis/
    └── minio/
```

---

*文档继续：第五章 Phase 4（见 KnowHub-Final-Part2.md）*
