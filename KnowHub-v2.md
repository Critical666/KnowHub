# KnowHub v2.0 - 企业RAG知识库SaaS 开发任务书

## 文档说明

本文档采用**从大到小**的思维逻辑组织，按照人类开发习惯编排：
1. **系统整体规划** - 先看全貌，理解要做什么
2. **功能模块拆解** - 拆成独立功能，逐个击破
3. **技术调研选型** - 确定每个功能使用的技术栈
4. **详细实现步骤** - 落地成代码文件或部署指南

**项目定位**：为企业提供一个开箱即用的RAG（检索增强生成）知识库SaaS平台。

---

## 第一章：系统整体规划

### 1.1 产品目标

| 功能 | 说明 |
|------|------|
| 知识库管理 | 企业可创建多个知识库（产品手册、FAQ、技术文档） |
| 文档上传 | 支持PDF、Word、Markdown、TXT等多种格式 |
| 智能问答 | AI基于知识库内容回答问题 |
| 多租户隔离 | 企业间数据完全隔离 |

### 1.2 系统架构

```
前端(React) → API(FastAPI) → 业务层 → RAG引擎 → 存储层
                                    ↓
                              Milvus(向量)
                              SQLite(元数据)
                              MinIO(文件)
```

### 1.3 技术栈选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | React + TypeScript | 类型安全、生态成熟 |
| 后端 | Python + FastAPI | 异步高性能、AI生态丰富 |
| 向量数据库 | Milvus Standalone | 高性能、生产级稳定 |
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

### 2.1 功能目标

搭建完整的开发环境，部署所有依赖服务（Milvus、Redis、MinIO），完成数据库模型设计。

**交付清单**：
- [ ] `docker-compose.yml`
- [ ] `backend/pyproject.toml`
- [ ] `backend/.env`
- [ ] `backend/app/core/config.py`
- [ ] `backend/app/core/database.py`
- [ ] `backend/app/models/` (4个文件)

### 2.2 技术调研：向量数据库选型

| 方案 | 性能 | 部署复杂度 | 数据规模 | 结论 |
|------|------|-----------|---------|------|
| Milvus Standalone | ⭐⭐⭐⭐⭐ | Docker Compose | 百万级 | ✅ 选用 |
| Pinecone | ⭐⭐⭐⭐⭐ | 托管服务 | 无限 | 成本高 |
| Chroma | ⭐⭐⭐ | pip安装 | 十万级 | 适合原型 |

### 2.3 详细实现步骤

#### 步骤1：Docker Compose配置

**文件**：`docker-compose.yml`

```yaml
version: '3.8'

services:
  etcd:
    container_name: knowhub-milvus-etcd
    image: quay.io/coreos/etcd:v3.5.5
    volumes:
      - ./volumes/etcd:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd

  milvus-minio:
    container_name: knowhub-milvus-minio
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - ./volumes/milvus-minio:/minio_data
    command: minio server /minio_data

  milvus-standalone:
    container_name: knowhub-milvus-standalone
    image: milvusdb/milvus:v2.4.0
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: milvus-minio:9000
    ports:
      - "19530:19530"
    depends_on:
      - etcd
      - milvus-minio

  redis:
    container_name: knowhub-redis
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    container_name: knowhub-minio
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"
```

#### 步骤2：Python依赖配置

**文件**：`backend/pyproject.toml`

```toml
[project]
name = "knowhub-backend"
version = "0.1.0"
description = "KnowHub - Enterprise RAG Knowledge Base SaaS"
requires-python = ">=3.12"

dependencies = [
    "fastapi>=0.135.3",
    "uvicorn>=0.42.0",
    "clerk-backend-api>=5.0.6",
    "pyjwt>=2.12.1",
    "sqlalchemy>=2.0.48",
    "python-dotenv>=1.2.2",
    "pydantic-settings>=2.0.0",
    "langchain>=0.3.0",
    "pymilvus>=2.5.0",
    "sentence-transformers>=3.0.0",
    "openai>=1.0.0",
    "celery>=5.4.0",
    "redis>=5.0.0",
    "minio>=7.2.0",
    "python-multipart>=0.0.9",
    "sse-starlette>=2.1.0",
]
```

#### 步骤3：环境变量配置

**文件**：`backend/.env`

```bash
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./knowhub.db
MILVUS_HOST=localhost
MILVUS_PORT=19530
KIMI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=rag-documents
BGE_MODEL_PATH=BAAI/bge-m3
EMBEDDING_DIMENSION=1024
```

#### 步骤4：核心配置类

**文件**：`backend/app/core/config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///./knowhub.db"
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: str = "19530"
    KIMI_API_KEY: str
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "kimi-k2.5"
    REDIS_URL: str = "redis://localhost:6379/0"
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "rag-documents"
    BGE_MODEL_PATH: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024
    
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

#### 步骤6：数据库模型

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

---

## 第三章：Phase 2 - 知识库管理功能

### 3.1 功能目标

实现知识库的CRUD功能。

**交付清单**：
- [ ] `backend/app/schemas/knowledge_base.py`
- [ ] `backend/app/services/rag/vector_store.py`
- [ ] `backend/app/api/knowledge_bases.py`
- [ ] `backend/app/main.py`

### 3.2 详细实现步骤

#### 步骤1：Schema定义

**文件**：`backend/app/schemas/knowledge_base.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class KnowledgeBaseResponse(BaseModel):
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
```

#### 步骤2：Milvus向量存储服务

**文件**：`backend/app/services/rag/vector_store.py`

```python
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from typing import List, Dict, Optional, Any


class MilvusVectorStore:
    def __init__(self, host: str = "localhost", port: str = "19530", dim: int = 1024):
        self.host = host
        self.port = port
        self.dim = dim
        connections.connect(alias="default", host=host, port=port)
    
    def _get_collection_name(self, kb_id: str) -> str:
        return f"kb_{kb_id}"
    
    def create_collection(self, kb_id: str) -> Collection:
        collection_name = self._get_collection_name(kb_id)
        if utility.has_collection(collection_name):
            return Collection(collection_name)
        
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=64, is_primary=True),
            FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="chunk_index", dtype=DataType.INT32),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=8192),
            FieldSchema(name="metadata", dtype=DataType.JSON),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dim)
        ]
        
        schema = CollectionSchema(fields)
        collection = Collection(name=collection_name, schema=schema)
        
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 16, "efConstruction": 200}
        }
        collection.create_index(field_name="embedding", index_params=index_params)
        collection.load()
        return collection
    
    def delete_collection(self, kb_id: str) -> None:
        collection_name = self._get_collection_name(kb_id)
        if utility.has_collection(collection_name):
            utility.drop_collection(collection_name)
```

#### 步骤3：API路由

**文件**：`backend/app/api/knowledge_bases.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseResponse
from app.services.rag.vector_store import MilvusVectorStore

router = APIRouter(prefix="/api/v1/knowledge-bases", tags=["knowledge-bases"])


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_kb(data: KnowledgeBaseCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    kb = KnowledgeBase(
        name=data.name,
        description=data.description,
        org_id=user.org_id,
        created_by=user.id
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    
    try:
        vector_store = MilvusVectorStore(
            host=settings.MILVUS_HOST,
            port=settings.MILVUS_PORT,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.create_collection(kb.id)
    except Exception as e:
        db.delete(kb)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to create vector collection: {str(e)}")
    
    return kb


@router.get("", response_model=list[KnowledgeBaseResponse])
async def list_kbs(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return db.query(KnowledgeBase).filter(
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status == KBStatus.ACTIVE
    ).all()


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    kb.status = KBStatus.DELETED
    db.commit()
    
    try:
        vector_store = MilvusVectorStore(host=settings.MILVUS_HOST, port=settings.MILVUS_PORT)
        vector_store.delete_collection(kb_id)
    except Exception:
        pass
    
    return None
```

#### 步骤4：主应用入口

**文件**：`backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import knowledge_bases

Base.metadata.create_all(bind=engine)

app = FastAPI(title="KnowHub API", description="Enterprise RAG Knowledge Base SaaS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knowledge_bases.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

---

## 第四章：Phase 3~7 概要

由于篇幅限制，详细代码请参考 `KnowHub.md`。以下是各阶段核心要点：

### Phase 3: 文档上传与存储
- 文件上传API
- MinIO对象存储集成
- 文档元数据记录

### Phase 4: 文档解析与向量化
- Celery异步任务
- 文档解析（PDF/DOCX/TXT/Markdown）
- BGE-M3 Embedding生成
- Milvus向量入库

### Phase 5: RAG问答功能
- 向量检索
- LLM生成（Kimi API）
- 流式响应（SSE）
- 会话管理

### Phase 6: 前端界面开发
- React + TypeScript
- 知识库管理页面
- 文档管理页面
- 对话界面

### Phase 7: 集成测试与优化
- 端到端测试
- 性能优化
- 部署文档

---

## 附录

### 启动命令

```bash
# 启动基础设施
cd /root/B2B-SaaS
docker-compose up -d

# 等待Milvus启动
sleep 30

# 启动后端
cd backend
uvicorn app.main:app --reload --port 8000
```

---

*文档版本: v2.0*  
*项目: KnowHub*  
*更新: 2026-04-15*
