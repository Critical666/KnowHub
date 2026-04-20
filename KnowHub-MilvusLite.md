# KnowHub - 企业RAG知识库SaaS 开发任务书 (Milvus Lite版)

## 文档说明

本文档针对**低配置云服务器**优化，使用 **Milvus Lite** 替代 Milvus Standalone。

**Milvus Lite vs Milvus Standalone**：
| 特性 | Milvus Lite | Milvus Standalone |
|------|-------------|-------------------|
| 部署方式 | pip安装，纯Python | Docker容器 |
| 资源占用 | 低（内存<500MB） | 高（内存>2GB） |
| 数据存储 | 本地文件 | etcd+minio |
| 适用场景 | 开发测试、小规模 | 生产环境、大规模 |
| 向量规模 | <100万 | 无限制 |

---

## 第一章：系统整体规划

### 1.1 产品目标

**KnowHub** 是企业RAG知识库SaaS平台，核心功能：

| 功能 | 说明 |
|------|------|
| 知识库管理 | 创建多个知识库（产品手册、FAQ、技术文档） |
| 文档上传 | 支持PDF、Word、Markdown、TXT |
| 智能问答 | AI基于知识库内容回答问题 |
| 多租户隔离 | 企业间数据完全隔离 |

### 1.2 系统架构（Milvus Lite版）

```
前端(React) → API(FastAPI) → 业务层 → RAG引擎 → 存储层
                                    ↓
                         Milvus Lite(本地文件)
                         MinIO(对象存储)
                         Redis(任务队列)
```

### 1.3 技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React + TypeScript | 类型安全、生态成熟 |
| 后端 | Python + FastAPI | 异步支持、AI生态丰富 |
| 向量库 | **Milvus Lite** | **轻量、无需Docker、适合低配置服务器** |
| Embedding | BGE-M3 | 中文效果好、开源免费 |
| LLM | Kimi K2.5 | 中文能力强、API稳定 |
| 存储 | MinIO | 兼容S3、易于部署 |
| 队列 | Celery + Redis | 异步处理文档 |

### 1.4 开发阶段

| 阶段 | 任务 | 时间 |
|------|------|------|
| Phase 1 | 环境搭建 + 数据库设计 | 1天 |
| Phase 2 | 知识库管理功能 | 1天 |
| Phase 3 | 文档上传与存储 | 1天 |
| Phase 4 | 文档解析与向量化 | 2天 |
| Phase 5 | RAG对话功能 | 2天 |
| Phase 6 | 前端界面 | 2天 |
| Phase 7 | 集成测试 | 1天 |

---

## 第二章：Phase 1 - 基础环境搭建

### 2.1 目标

搭建开发环境，部署依赖服务，完成数据库模型设计。

**交付物**：
- [ ] docker-compose.yml（仅Redis+MinIO，**无Milvus**）
- [ ] pyproject.toml（依赖，**包含milvus-lite**）
- [ ] .env（环境变量）
- [ ] 数据库模型（3个文件）

### 2.2 技术调研：为什么选择Milvus Lite

**调研背景**：云服务器硬件配置有限，无法运行Milvus Standalone

| 方案 | 资源需求 | 部署复杂度 | 数据持久化 | 结论 |
|------|---------|-----------|-----------|------|
| **Milvus Lite** | 内存<500MB | pip安装 | 本地文件 | ✅ **选用** |
| Milvus Standalone | 内存>2GB | Docker Compose | etcd+minio | 配置不足 |
| Chroma | 内存<300MB | pip安装 | 本地文件 | 备选 |
| FAISS | 内存<200MB | pip安装 | 需手动管理 | 需自研封装 |

**Milvus Lite特点**：
- 纯Python实现，pip直接安装
- 数据存储在本地文件（每个Collection一个.db文件）
- API与Milvus Standalone兼容，未来可无缝迁移
- 支持100万以下向量规模，适合中小企业场景

### 2.3 实现步骤

#### 步骤1：Docker Compose配置（简化版）

**说明**：Milvus Lite不需要Docker，只需Redis和MinIO

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
docker-compose up -d

# 验证（只需2个容器）
docker-compose ps
# 应显示: redis, minio 运行中
```

#### 步骤2：更新pyproject.toml（添加milvus-lite）

**文件**：`backend/pyproject.toml`

在现有dependencies后追加：

```toml
dependencies = [
    # 现有依赖保持不变...
    "clerk-backend-api>=5.0.6",
    "fastapi>=0.135.3",
    "pyjwt>=2.12.1",
    "python-dotenv>=1.2.2",
    "sqlalchemy>=2.0.48",
    "svix>=1.90.0",
    "uvicorn>=0.42.0",
    
    # ========== 新增RAG相关依赖 ==========
    # LangChain - 文档处理框架
    "langchain>=0.3.0",
    "langchain-community>=0.3.0",
    
    # ========== 关键变更：使用milvus-lite ==========
    # Milvus Lite - 轻量级向量数据库（纯Python，无需Docker）
    "milvus-lite>=2.4.0",
    "pymilvus>=2.4.0",  # 客户端SDK，与Lite兼容
    
    # Embedding模型
    "sentence-transformers>=3.0.0",
    
    # LLM客户端 (OpenAI兼容格式)
    "openai>=1.0.0",
    
    # 异步任务队列
    "celery>=5.4.0",
    "redis>=5.0.0",
    
    # 对象存储
    "minio>=7.2.0",
    
    # 工具库
    "python-multipart>=0.0.9",  # 文件上传
    "sse-starlette>=2.1.0",     # SSE流式响应
    "numpy>=1.26.0",
    "pypdf>=5.0.0",
    "python-docx>=1.1.0",
    "markdown>=3.7.0",
]
```

**安装依赖**：
```bash
cd /root/B2B-SaaS/backend
uv pip install -e .

# 验证milvus-lite安装
python -c "from milvus_lite import MilvusClient; print('Milvus Lite OK')"
```

#### 步骤3：环境变量配置

**文件**：`backend/.env`

```bash
# ========== 现有配置 ==========
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
SVIX_SECRET=whsec_xxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173

# 数据库 (SQLite用于开发)
DATABASE_URL=sqlite:///./knowhub.db

# ========== 关键变更：Milvus Lite配置 ==========
# Milvus Lite使用本地文件存储，无需host/port
# 数据将存储在 ./milvus_data/ 目录下
MILVUS_LITE_PATH=./milvus_data/knowhub.db
MILVUS_COLLECTION_PREFIX=kb_

# Kimi (Moonshot) LLM
# 获取地址: https://platform.moonshot.cn/
KIMI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5

# Redis (Celery消息队列)
REDIS_URL=redis://localhost:6379/0

# MinIO对象存储
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=rag-documents
MINIO_SECURE=false

# BGE-M3 Embedding模型
# 首次运行会自动下载模型到本地缓存（约1GB）
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

#### 步骤4：更新核心配置类

**文件**：`backend/app/core/config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 现有配置
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    SVIX_SECRET: str
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

#### 步骤5：创建Milvus Lite向量存储服务

**关键变更**：使用MilvusClient替代pymilvus的connections

**文件**：`backend/app/services/rag/vector_store.py`

```python
"""
Milvus Lite向量数据库服务

与Milvus Standalone的区别：
1. 使用MilvusClient直接操作本地文件
2. 无需连接服务器，数据存储在本地.db文件
3. API兼容，未来可无缝迁移到Standalone
"""

from milvus_lite import MilvusClient
from typing import List, Dict, Optional, Any
import os
import logging

logger = logging.getLogger(__name__)


class MilvusVectorStore:
    """Milvus Lite向量存储操作类"""
    
    def __init__(self, db_path: str = "./milvus_data/knowhub.db", dim: int = 1024):
        """
        初始化Milvus Lite客户端
        
        Args:
            db_path: 本地数据库文件路径
            dim: 向量维度（BGE-M3为1024）
        """
        self.db_path = db_path
        self.dim = dim
        
        # 确保目录存在
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # 创建客户端（自动创建文件如果不存在）
        self.client = MilvusClient(db_path)
        logger.info(f"Milvus Lite initialized: {db_path}")
    
    def _get_collection_name(self, kb_id: str) -> str:
        """生成Collection名称"""
        return f"kb_{kb_id}"
    
    def create_collection(self, kb_id: str) -> bool:
        """
        为知识库创建Collection
        
        Args:
            kb_id: 知识库ID
            
        Returns:
            是否创建成功
        """
        collection_name = self._get_collection_name(kb_id)
        
        # 检查是否已存在
        if self.client.has_collection(collection_name):
            logger.info(f"Collection {collection_name} already exists")
            return True
        
        # 创建Collection（Milvus Lite简化了Schema定义）
        self.client.create_collection(
            collection_name=collection_name,
            dimension=self.dim,
            metric_type="COSINE",  # 余弦相似度
            primary_field="id",
            vector_field="embedding"
        )
        
        logger.info(f"Created collection {collection_name} with dim={self.dim}")
        return True
    
    def insert_chunks(self, kb_id: str, chunks: List[Dict[str, Any]]) -> None:
        """
        批量插入文档片段
        
        Args:
            kb_id: 知识库ID
            chunks: 片段列表，每个片段包含:
                - id: 片段ID
                - doc_id: 文档ID
                - chunk_index: 片段序号
                - content: 文本内容
                - metadata: 元数据字典
                - embedding: 向量（List[float]）
        """
        if not chunks:
            logger.warning("No chunks to insert")
            return
        
        collection_name = self._get_collection_name(kb_id)
        
        # 确保Collection存在
        if not self.client.has_collection(collection_name):
            self.create_collection(kb_id)
        
        # 准备数据（Milvus Lite使用更简单的格式）
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
        
        # 批量插入
        self.client.insert(collection_name, data)
        logger.info(f"Inserted {len(chunks)} chunks into {collection_name}")
    
    def search(
        self,
        kb_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        score_threshold: float = 0.0,
        doc_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        向量相似度检索
        
        Args:
            kb_id: 知识库ID
            query_embedding: 查询向量
            top_k: 返回结果数量
            score_threshold: 相似度阈值
            doc_ids: 指定文档ID列表（可选）
            
        Returns:
            检索结果列表
        """
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            logger.warning(f"Collection {collection_name} does not exist")
            return []
        
        # 构建过滤条件（Milvus Lite支持简单的过滤）
        filter_expr = None
        if doc_ids:
            # Milvus Lite的过滤语法
            doc_id_list = ", ".join([f'"{doc_id}"' for doc_id in doc_ids])
            filter_expr = f"doc_id in [{doc_id_list}]"
        
        # 执行搜索
        results = self.client.search(
            collection_name=collection_name,
            data=[query_embedding],
            limit=top_k,
            output_fields=["doc_id", "content", "metadata", "chunk_index"],
            filter=filter_expr
        )
        
        # 解析结果
        hits = []
        for result in results[0]:  # 取第一个查询的结果
            hit = {
                "id": result["id"],
                "doc_id": result["doc_id"],
                "content": result["content"],
                "metadata": result["metadata"],
                "chunk_index": result["chunk_index"],
                "score": result["distance"]  # Milvus Lite使用distance字段
            }
            # 应用分数阈值过滤（注意：Milvus Lite返回的是距离，余弦相似度=1-距离）
            similarity = 1 - hit["score"]
            if score_threshold <= 0 or similarity >= score_threshold:
                hit["score"] = similarity  # 转换为相似度
                hits.append(hit)
        
        logger.info(f"Search in {collection_name} returned {len(hits)} results")
        return hits
    
    def delete_by_doc_id(self, kb_id: str, doc_id: str) -> None:
        """删除指定文档的所有片段"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return
        
        # Milvus Lite删除语法
        self.client.delete(collection_name, filter=f"doc_id == '{doc_id}'")
        logger.info(f"Deleted chunks for doc {doc_id} from {collection_name}")
    
    def delete_collection(self, kb_id: str) -> None:
        """删除整个知识库的Collection"""
        collection_name = self._get_collection_name(kb_id)
        
        if self.client.has_collection(collection_name):
            self.client.drop_collection(collection_name)
            logger.info(f"Dropped collection {collection_name}")
    
    def get_stats(self, kb_id: str) -> Dict[str, int]:
        """获取知识库统计信息"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return {"total": 0}
        
        stats = self.client.get_collection_stats(collection_name)
        return {"total": stats.get("row_count", 0)}
```

#### 步骤6：创建数据库模型（与原版相同）

**文件**：`backend/app/models/knowledge_base.py`

```python
"""知识库模型"""
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
    status = Column(Enum(KBStatus), nullable=False, default=KBStatus.ACTIVE)
    document_count = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "org_id": self.org_id,
            "created_by": self.created_by,
            "status": self.status.value,
            "document_count": self.document_count,
            "total_chunks": self.total_chunks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
```

**文件**：`backend/app/models/document.py`

```python
"""文档模型"""
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
    status = Column(Enum(DocStatus), nullable=False, default=DocStatus.PENDING)
    chunk_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "kb_id": self.kb_id,
            "filename": self.filename,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "status": self.status.value,
            "chunk_count": self.chunk_count,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
```

**文件**：`backend/app/models/chat.py`

```python
"""对话模型"""
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
    
    def to_dict(self):
        return {
            "id": self.id,
            "kb_id": self.kb_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role.value,
            "content": self.content,
            "sources": self.sources,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
```

**文件**：`backend/app/models/__init__.py`

```python
from app.models.task import Task, TaskStatus
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.models.document import Document, DocStatus
from app.models.chat import ChatSession, ChatMessage, MessageRole

__all__ = [
    "Task", "TaskStatus",
    "KnowledgeBase", "KBStatus",
    "Document", "DocStatus",
    "ChatSession", "ChatMessage", "MessageRole",
]
```

### 2.4 Phase 1 验证清单（Milvus Lite版）

```bash
# 1. 启动依赖服务（只需Redis和MinIO）
docker-compose up -d

# 2. 检查服务状态（只需2个容器）
docker-compose ps
# 应显示: redis, minio 运行中
# 注意：没有milvus-standalone容器

# 3. 安装后端依赖（包含milvus-lite）
cd backend
uv pip install -e .

# 4. 验证Milvus Lite安装
python -c "from milvus_lite import MilvusClient; print('✓ Milvus Lite OK')"

# 5. 验证模型导入
python -c "from app.models import KnowledgeBase, Document, ChatSession; print('✓ Models OK')"

# 6. 验证配置加载
python -c "from app.core.config import settings; print(f'✓ Milvus Lite path: {settings.MILVUS_LITE_PATH}')"

# 7. 测试Milvus Lite基本功能
python << 'PYEOF'
from app.services.rag.vector_store import MilvusVectorStore
store = MilvusVectorStore(db_path="./test_milvus.db", dim=1024)
store.create_collection("test_kb")
print("✓ Milvus Lite collection created")
print(f"✓ Database file: ./test_milvus.db")
PYEOF
```

---

## 第三章：Phase 2 - 知识库管理功能

### 3.1 目标

实现知识库的CRUD功能。

**交付物**：
- [ ] Pydantic Schema
- [ ] API路由（使用Milvus Lite）
- [ ] 主应用更新

### 3.2 实现步骤

#### 步骤1：Schema定义（与原版相同）

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

#### 步骤2：API路由（使用Milvus Lite）

**关键变更**：使用`MILVUS_LITE_PATH`替代`MILVUS_HOST/MILVUS_PORT`

**文件**：`backend/app/api/knowledge_bases.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseResponse
from app.services.rag.vector_store import MilvusVectorStore
from app.core.config import settings

router = APIRouter(prefix="/api/v1/knowledge-bases", tags=["knowledge-bases"])


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_kb(data: KnowledgeBaseCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    创建知识库
    
    流程：
    1. 在SQLite中创建知识库记录
    2. 在Milvus Lite中创建对应的Collection（本地文件）
    """
    # 1. 创建数据库记录
    kb = KnowledgeBase(
        name=data.name,
        description=data.description,
        org_id=user.org_id,
        created_by=user.id
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    
    # 2. 创建Milvus Lite Collection（本地文件操作）
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,  # 关键变更：使用本地文件路径
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.create_collection(kb.id)
    except Exception as e:
        # 如果Milvus创建失败，回滚数据库
        db.delete(kb)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create vector collection: {str(e)}"
        )
    
    return kb


@router.get("", response_model=List[KnowledgeBaseResponse])
async def list_kbs(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """获取当前用户的知识库列表"""
    return db.query(KnowledgeBase).filter(
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status == KBStatus.ACTIVE
    ).all()


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_kb(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """获取知识库详情"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    删除知识库（软删除）
    
    流程：
    1. 将数据库记录标记为DELETED
    2. 删除Milvus Lite中的Collection数据
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # 软删除
    kb.status = KBStatus.DELETED
    db.commit()
    
    # 删除Milvus Lite Collection（本地文件操作）
    try:
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH  # 关键变更：使用本地文件路径
        )
        vector_store.delete_collection(kb_id)
    except Exception as e:
        # 记录日志但不阻止删除操作
        print(f"Warning: Failed to delete Milvus collection: {e}")
    
    return None
```

#### 步骤3：更新主应用入口

**文件**：`backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import tasks, webhooks, knowledge_bases

# 创建所有数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KnowHub API (Milvus Lite)",
    description="Enterprise RAG Knowledge Base SaaS - Lightweight Edition",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tasks.router)
app.include_router(webhooks.router)
app.include_router(knowledge_bases.router)
```

### 3.3 Phase 2 验证清单

```bash
# 1. 启动后端
cd /root/B2B-SaaS/backend
uvicorn app.main:app --reload --port 8000

# 2. 测试API（使用curl或浏览器访问）

# 创建知识库
curl -X POST http://localhost:8000/api/v1/knowledge-bases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{"name": "测试知识库", "description": "用于测试"}'

# 获取列表
curl http://localhost:8000/api/v1/knowledge-bases \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# 3. 验证Milvus Lite数据文件
ls -lh ./milvus_data/
# 应看到: knowhub.db 文件
```

---

## 第四章~第七章说明

由于篇幅限制，Phase 3~7 的代码与原版基本一致，只需注意以下**关键变更点**：

### 所有服务使用Milvus Lite的方式

```python
from app.core.config import settings
from app.services.rag.vector_store import MilvusVectorStore

# 创建向量存储实例（使用本地文件）
vector_store = MilvusVectorStore(
    db_path=settings.MILVUS_LITE_PATH,  # 如: "./milvus_data/knowhub.db"
    dim=settings.EMBEDDING_DIMENSION     # 1024
)

# 其他API保持不变
vector_store.create_collection(kb_id)
vector_store.insert_chunks(kb_id, chunks)
results = vector_store.search(kb_id, query_embedding, top_k=5)
```

### Docker Compose最终版（仅2个服务）

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
    restart: unless-stopped

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

### 资源占用对比

| 组件 | Milvus Standalone版 | Milvus Lite版 |
|------|---------------------|---------------|
| Docker容器数 | 5个 | 2个 |
| 内存需求 | >2GB | <500MB |
| 磁盘需求 | >10GB | <1GB |
| 启动时间 | 2-3分钟 | 10秒 |

### 数据备份

Milvus Lite数据存储在单个文件中，备份非常简单：

```bash
# 备份
cp ./milvus_data/knowhub.db ./backup/knowhub_$(date +%Y%m%d).db

# 恢复
cp ./backup/knowhub_20250410.db ./milvus_data/knowhub.db
```

### 迁移到Milvus Standalone

未来如果需要迁移到完整版Milvus：

```python
# 1. 从Milvus Lite导出数据
from app.services.rag.vector_store import MilvusVectorStore

lite_store = MilvusVectorStore(db_path="./milvus_data/knowhub.db")
data = lite_store.client.query("kb_your_id", filter="", output_fields=["*"])

# 2. 导入到Milvus Standalone
from pymilvus import connections, Collection

connections.connect(host="milvus-server", port="19530")
collection = Collection("kb_your_id")
collection.insert(data)
```

---

## 完整启动命令（Milvus Lite版）

```bash
# 1. 启动依赖服务（仅需Redis+MinIO）
docker-compose up -d

# 2. 启动Celery Worker（终端1）
cd backend
celery -A app.celery_tasks.celery_app worker --loglevel=info

# 3. 启动后端API（终端2）
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. 启动前端（终端3）
cd frontend
npm run dev
```

---

## 关键文件变更总结

| 文件 | 变更内容 |
|------|---------|
| `docker-compose.yml` | 移除etcd、milvus-standalone，仅保留redis、minio |
| `pyproject.toml` | `pymilvus` → `milvus-lite>=2.4.0` |
| `.env` | `MILVUS_HOST/PORT` → `MILVUS_LITE_PATH` |
| `app/core/config.py` | 配置项改为`MILVUS_LITE_PATH` |
| `app/services/rag/vector_store.py` | 使用`MilvusClient`替代`connections` |

---

*文档版本: v2.0-MilvusLite*
*项目: KnowHub*
*更新: 2025-04-10*
*适用环境: 低配置云服务器*
