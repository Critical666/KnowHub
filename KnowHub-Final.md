# KnowHub - 企业RAG知识库SaaS 开发任务书（最终版）

## 文档说明

本文档采用**从大到小**的思维逻辑组织：
1. **系统整体规划** - 先看全貌
2. **功能模块拆解** - 拆成独立功能
3. **技术调研选型** - 确定技术栈
4. **详细实现步骤** - 落地成代码

**项目定位**：为企业提供一个开箱即用的RAG知识库SaaS平台。

**技术方案**：使用 **Milvus Lite**（轻量级向量数据库），适合低配置云服务器。

---

## 第一章：系统整体规划

### 1.1 产品目标

| 功能 | 说明 |
|------|------|
| 知识库管理 | 创建多个知识库（产品手册、FAQ、技术文档） |
| 文档上传 | 支持PDF、Word、Markdown、TXT等格式 |
| 智能问答 | AI基于知识库内容回答问题 |
| 多租户隔离 | 企业间数据完全隔离 |

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

### 2.1 功能目标

搭建开发环境，部署依赖服务（Redis、MinIO），完成数据库模型设计，集成Milvus Lite。

**交付清单**：
- [ ] `docker-compose.yml` - 仅Redis+MinIO
- [ ] `backend/pyproject.toml` - Python依赖
- [ ] `backend/.env` - 环境变量
- [ ] `backend/app/core/config.py` - 核心配置
- [ ] `backend/app/core/database.py` - 数据库连接
- [ ] `backend/app/services/rag/vector_store.py` - Milvus Lite服务
- [ ] `backend/app/models/` - 数据库模型

### 2.2 技术调研：为什么选择Milvus Lite

| 方案 | 资源需求 | 部署复杂度 | 数据规模 | 结论 |
|------|---------|-----------|---------|------|
| **Milvus Lite** | 内存<500MB | pip安装 | <100万 | ✅ 选用 |
| Milvus Standalone | 内存>2GB | Docker | 无限制 | 配置不足 |
| Chroma | 内存<300MB | pip安装 | <10万 | 备选 |

**Milvus Lite特点**：
- 纯Python实现，pip直接安装
- 数据存储在本地文件（.db文件）
- API与Milvus Standalone兼容
- 支持100万以下向量规模

### 2.3 详细实现步骤

#### 步骤1：Docker Compose配置

**文件**：`docker-compose.yml`

```yaml
version: '3.8'

services:
  redis:
    container_name: knowhub-redis
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./volumes/redis:/data

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
]
```

**安装依赖**：
```bash
cd backend
uv pip install -e ".[dev]"
python -c "from milvus_lite import MilvusClient; print('OK')"
```

#### 步骤3：环境变量配置

**文件**：`backend/.env`

```bash
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./knowhub.db

# Milvus Lite配置（使用本地文件路径）
MILVUS_LITE_PATH=./milvus_data/knowhub.db
MILVUS_COLLECTION_PREFIX=kb_

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
    
    # Milvus Lite配置
    MILVUS_LITE_PATH: str = "./milvus_data/knowhub.db"
    MILVUS_COLLECTION_PREFIX: str = "kb_"
    
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

---

## 第三章：Phase 2 - 知识库管理功能

### 3.1 功能目标

实现知识库的CRUD功能。

**交付清单**：
- [ ] `backend/app/schemas/knowledge_base.py`
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

#### 步骤2：API路由

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
            db_path=settings.MILVUS_LITE_PATH,
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
        vector_store = MilvusVectorStore(db_path=settings.MILVUS_LITE_PATH)
        vector_store.delete_collection(kb_id)
    except Exception:
        pass
    
    return None
```

#### 步骤3：主应用入口

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

### Phase 3: 文档上传与存储
- 文件上传API（multipart/form-data）
- MinIO对象存储集成
- 文档元数据记录到SQLite

### Phase 4: 文档解析与向量化
- Celery异步任务处理文档
- 文档解析（PDF/DOCX/TXT/Markdown）
- BGE-M3 Embedding生成
- Milvus Lite向量入库

### Phase 5: RAG问答功能
- 向量检索（Milvus Lite search）
- LLM生成（Kimi API）
- 流式响应（SSE）
- 会话管理

### Phase 6: 前端界面开发
- React + TypeScript + Vite
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

# 启动后端
cd backend
uvicorn app.main:app --reload --port 8000
```

### 项目结构

```
/root/B2B-SaaS/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── pyproject.toml
│   └── .env
└── volumes/
```

---

*文档版本: v3.0 (最终版)*  
*项目: KnowHub*  
*技术方案: Milvus Lite*  
*更新: 2026-04-15*
