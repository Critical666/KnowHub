# KnowHub - 企业RAG知识库SaaS 完整开发文档

## 项目概述

**KnowHub** 是一个为企业提供的RAG（检索增强生成）知识库SaaS平台。

---

## 第一部分：后端开发

### 1.1 环境配置

#### 1.1.1 扩展依赖 (pyproject.toml)

```toml
[project]
name = "backend"
version = "0.1.0"
description = "KnowHub - Enterprise RAG Knowledge Base SaaS"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "clerk-backend-api>=5.0.6",
    "fastapi>=0.135.3",
    "pyjwt>=2.12.1",
    "python-dotenv>=1.2.2",
    "sqlalchemy>=2.0.48",
    "svix>=1.90.0",
    "uvicorn>=0.42.0",
    "langchain>=0.3.0",
    "langchain-community>=0.3.0",
    "langchain-milvus>=0.1.0",
    "unstructured[all-docs]>=0.16.0",
    "pymilvus>=2.5.0",
    "sentence-transformers>=3.0.0",
    "openai>=1.0.0",
    "celery>=5.4.0",
    "redis>=5.0.0",
    "minio>=7.2.0",
    "python-multipart>=0.0.9",
    "sse-starlette>=2.1.0",
    "numpy>=1.26.0",
    "pypdf>=5.0.0",
    "python-docx>=1.1.0",
    "markdown>=3.7.0",
]
```

#### 1.1.2 环境变量配置 (.env)

```bash
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
SVIX_SECRET=whsec_xxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./knowhub.db
MILVUS_HOST=localhost
MILVUS_PORT=19530
KIMI_API_KEY=sk-xxxxxxxxxxxxxxxx
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=rag-documents
MINIO_SECURE=false
BGE_MODEL_PATH=BAAI/bge-m3
EMBEDDING_DIMENSION=1024
DOCUMENT_CHUNK_SIZE=500
DOCUMENT_CHUNK_OVERLAP=50
MAX_FILE_SIZE=50MB
RETRIEVAL_TOP_K=5
RETRIEVAL_SCORE_THRESHOLD=0.7
```

---

### 1.2 数据库模型设计

#### 1.2.1 知识库模型 (app/models/knowledge_base.py)

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
    name = Column(String(255), nullable=False, comment="知识库名称")
    description = Column(Text, nullable=True, comment="知识库描述")
    org_id = Column(String(255), nullable=False, index=True, comment="组织ID")
    created_by = Column(String(255), nullable=False, comment="创建者ID")
    status = Column(Enum(KBStatus), nullable=False, default=KBStatus.ACTIVE, comment="状态")
    document_count = Column(Integer, default=0, comment="文档数量")
    total_chunks = Column(Integer, default=0, comment="总片段数")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
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

#### 1.2.2 文档模型 (app/models/document.py)

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
    kb_id = Column(String(64), ForeignKey("knowledge_bases.id"), nullable=False, index=True, comment="知识库ID")
    org_id = Column(String(255), nullable=False, index=True, comment="组织ID")
    filename = Column(String(500), nullable=False, comment="原始文件名")
    file_size = Column(Integer, nullable=False, comment="文件大小(字节)")
    file_type = Column(String(50), nullable=False, comment="文件类型")
    storage_path = Column(String(1000), nullable=False, comment="存储路径")
    status = Column(Enum(DocStatus), nullable=False, default=DocStatus.PENDING, comment="处理状态")
    chunk_count = Column(Integer, default=0, comment="分块数量")
    error_message = Column(Text, nullable=True, comment="错误信息")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
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

#### 1.2.3 对话模型 (app/models/chat.py)

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
    kb_id = Column(String(64), ForeignKey("knowledge_bases.id"), nullable=False, index=True, comment="知识库ID")
    org_id = Column(String(255), nullable=False, index=True, comment="组织ID")
    created_by = Column(String(255), nullable=False, comment="创建者ID")
    title = Column(String(255), nullable=True, comment="会话标题")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
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
    session_id = Column(String(64), ForeignKey("chat_sessions.id"), nullable=False, index=True, comment="会话ID")
    role = Column(Enum(MessageRole), nullable=False, comment="角色")
    content = Column(Text, nullable=False, comment="内容")
    sources = Column(JSON, nullable=True, comment="引用来源")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
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

#### 1.2.4 模型初始化文件 (app/models/__init__.py)

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

---

### 1.3 Schema定义 (Pydantic模型)

#### 1.3.1 知识库Schema (app/schemas/knowledge_base.py)

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="知识库名称")
    description: Optional[str] = Field(None, max_length=1000, description="知识库描述")


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
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


class KnowledgeBaseListResponse(BaseModel):
    items: list[KnowledgeBaseResponse]
    total: int
```

#### 1.3.2 文档Schema (app/schemas/document.py)

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    file_type: str
    status: str
    message: str = "文档上传成功，正在处理中"


class DocumentResponse(BaseModel):
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
    items: list[DocumentResponse]
    total: int


class DocumentStatusResponse(BaseModel):
    id: str
    filename: str
    status: str
    chunk_count: int
    error_message: Optional[str]
    progress: Optional[int] = Field(None, description="处理进度百分比")
```

#### 1.3.3 对话Schema (app/schemas/chat.py)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="会话标题，不传则自动生成")


class ChatSessionResponse(BaseModel):
    id: str
    kb_id: str
    title: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="用户消息内容")
    session_id: Optional[str] = Field(None, description="会话ID，不传则创建新会话")


class SourceItem(BaseModel):
    doc_id: str
    doc_name: Optional[str] = Field(None, description="文档名称")
    content: str = Field(..., description="引用内容片段")
    score: float = Field(..., description="相似度分数")
    chunk_index: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[List[SourceItem]]
    created_at: datetime


class ChatStreamChunk(BaseModel):
    type: str = Field(..., description="数据类型: sources/chunk/done/error")
    data: dict
```

#### 1.3.4 Schema初始化文件 (app/schemas/__init__.py)

```python
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse, KnowledgeBaseListResponse
)
from app.schemas.document import (
    DocumentUploadResponse, DocumentResponse, DocumentListResponse, DocumentStatusResponse
)
from app.schemas.chat import (
    ChatSessionCreate, ChatSessionResponse, ChatMessageRequest,
    ChatMessageResponse, SourceItem, ChatStreamChunk
)

__all__ = [
    "KnowledgeBaseCreate", "KnowledgeBaseUpdate", "KnowledgeBaseResponse", "KnowledgeBaseListResponse",
    "DocumentUploadResponse", "DocumentResponse", "DocumentListResponse", "DocumentStatusResponse",
    "ChatSessionCreate", "ChatSessionResponse", "ChatMessageRequest",
    "ChatMessageResponse", "SourceItem", "ChatStreamChunk",
]
```


---

### 1.4 核心服务实现

#### 1.4.1 Milvus向量存储服务 (app/services/rag/vector_store.py)

```python
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class MilvusVectorStore:
    def __init__(self, host: str = "localhost", port: str = "19530", dim: int = 1024):
        self.host = host
        self.port = port
        self.dim = dim
        self._connect()
    
    def _connect(self):
        connections.connect(alias="default", host=self.host, port=self.port)
        logger.info(f"Connected to Milvus at {self.host}:{self.port}")
    
    def _get_collection_name(self, kb_id: str) -> str:
        return f"kb_{kb_id}"
    
    def create_collection(self, kb_id: str) -> Collection:
        collection_name = self._get_collection_name(kb_id)
        if utility.has_collection(collection_name):
            collection = Collection(collection_name)
            collection.load()
            return collection
        
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=64, is_primary=True),
            FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="chunk_index", dtype=DataType.INT32),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=8192),
            FieldSchema(name="metadata", dtype=DataType.JSON),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dim)
        ]
        
        schema = CollectionSchema(fields, description=f"Knowledge base collection for {kb_id}")
        collection = Collection(name=collection_name, schema=schema)
        
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 16, "efConstruction": 200}
        }
        collection.create_index(field_name="embedding", index_params=index_params)
        collection.load()
        return collection
    
    def insert_chunks(self, kb_id: str, chunks: List[Dict[str, Any]]) -> None:
        if not chunks:
            return
        collection_name = self._get_collection_name(kb_id)
        collection = Collection(collection_name)
        collection.load()
        
        entities = [
            [c["id"] for c in chunks],
            [c["doc_id"] for c in chunks],
            [c["chunk_index"] for c in chunks],
            [c["content"] for c in chunks],
            [c.get("metadata", {}) for c in chunks],
            [c["embedding"] for c in chunks]
        ]
        collection.insert(entities)
        collection.flush()
    
    def search(self, kb_id: str, query_embedding: List[float], top_k: int = 5,
               score_threshold: float = 0.0, doc_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        collection_name = self._get_collection_name(kb_id)
        if not utility.has_collection(collection_name):
            return []
        
        collection = Collection(collection_name)
        collection.load()
        
        expr = None
        if doc_ids:
            doc_id_str = ", ".join([f'"{doc_id}"' for doc_id in doc_ids])
            expr = f"doc_id in [{doc_id_str}]"
        
        search_params = {"metric_type": "COSINE", "params": {"ef": 64}}
        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=["doc_id", "content", "metadata", "chunk_index"]
        )
        
        hits = []
        for result in results[0]:
            hit = {
                "id": result.id,
                "doc_id": result.entity.get("doc_id"),
                "content": result.entity.get("content"),
                "metadata": result.entity.get("metadata"),
                "chunk_index": result.entity.get("chunk_index"),
                "score": result.score
            }
            if score_threshold <= 0 or hit["score"] >= score_threshold:
                hits.append(hit)
        return hits
    
    def delete_by_doc_id(self, kb_id: str, doc_id: str) -> None:
        collection_name = self._get_collection_name(kb_id)
        if not utility.has_collection(collection_name):
            return
        collection = Collection(collection_name)
        expr = f'doc_id == "{doc_id}"'
        collection.delete(expr)
    
    def delete_collection(self, kb_id: str) -> None:
        collection_name = self._get_collection_name(kb_id)
        if utility.has_collection(collection_name):
            utility.drop_collection(collection_name)
```

#### 1.4.2 Embedding服务 (app/services/rag/embedding_service.py)

```python
from sentence_transformers import SentenceTransformer
from typing import List


class BGEEmbeddingService:
    def __init__(self, model_path: str = "BAAI/bge-m3"):
        self.model = SentenceTransformer(model_path)
        self.dim = 1024
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        instruction = "为这个句子生成表示以用于检索相关文章："
        texts_with_instruction = [instruction + t for t in texts]
        embeddings = self.model.encode(texts_with_instruction, normalize_embeddings=True, batch_size=32)
        return embeddings.tolist()
    
    def embed_query(self, text: str) -> List[float]:
        instruction = "为这个句子生成表示以用于检索相关文章："
        embedding = self.model.encode(instruction + text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self.embed_documents(batch)
            all_embeddings.extend(embeddings)
        return all_embeddings
```

#### 1.4.3 LLM服务 (app/services/rag/llm_service.py)

```python
from openai import AsyncOpenAI
from typing import List, Dict, AsyncGenerator


class KimiLLMService:
    def __init__(self, api_key: str, base_url: str = "https://api.moonshot.cn/v1"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = "kimi-k2.5"
    
    async def generate_stream(self, query: str, contexts: List[Dict],
                              conversation_history: List[Dict] = None,
                              temperature: float = 0.3) -> AsyncGenerator[str, None]:
        system_prompt = "你是一个专业的企业知识库助手。基于提供的参考信息回答用户问题。"
        context_text = "\n\n".join([f"[参考{i+1}] {ctx['content'][:500]}" for i, ctx in enumerate(contexts)])
        user_message = f"""基于以下参考信息回答问题：

{context_text}

---
用户问题：{query}"""

        messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_message})
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

#### 1.4.4 文档处理服务 (app/services/rag/document_processor.py)

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Dict
import os
import uuid


class DocumentProcessor:
    SUPPORTED_FORMATS = {'.txt', '.md', '.pdf', '.docx'}
    
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", "。", "，", " ", ""]
        )
    
    def process(self, file_path: str, metadata: Dict = None) -> List[Dict]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {ext}")
        
        if ext == '.txt' or ext == '.md':
            with open(file_path, 'r', encoding='utf-8') as f:
                full_text = f.read()
        else:
            full_text = self._extract_text(file_path, ext)
        
        doc_metadata = {"source": os.path.basename(file_path), "file_type": ext, **(metadata or {})}
        chunks = self.text_splitter.split_text(full_text)
        
        result = []
        for i, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            result.append({
                "id": chunk_id,
                "content": chunk,
                "metadata": {**doc_metadata, "chunk_index": i, "total_chunks": len(chunks)},
                "chunk_index": i
            })
        return result
    
    def _extract_text(self, file_path: str, ext: str) -> str:
        return f"[Document content from {ext} file]"
```

#### 1.4.5 对象存储服务 (app/services/storage/minio_client.py)

```python
from minio import Minio
from typing import BinaryIO
import uuid


class MinioStorageService:
    def __init__(self, endpoint: str, access_key: str, secret_key: str,
                 bucket: str = "rag-documents", secure: bool = False):
        self.client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self.bucket = bucket
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
    
    def upload_file(self, file_data: BinaryIO, filename: str, org_id: str) -> str:
        object_name = f"{org_id}/{uuid.uuid4()}_{filename}"
        file_data.seek(0)
        self.client.put_object(self.bucket, object_name, file_data, length=-1, part_size=10*1024*1024)
        return object_name
    
    def download_file(self, object_name: str, file_path: str):
        self.client.fget_object(self.bucket, object_name, file_path)
    
    def delete_file(self, object_name: str):
        self.client.remove_object(self.bucket, object_name)
```

---

### 1.5 Celery异步任务

#### 1.5.1 Celery配置 (app/celery_tasks/celery_app.py)

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "knowhub_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.celery_tasks.document_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1
)
```

#### 1.5.2 文档处理任务 (app/celery_tasks/document_tasks.py)

```python
import os
from app.celery_tasks.celery_app import celery_app
from app.services.rag.document_processor import DocumentProcessor
from app.services.rag.embedding_service import BGEEmbeddingService
from app.services.rag.vector_store import MilvusVectorStore
from app.services.storage.minio_client import MinioStorageService
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.document import Document, DocStatus
from app.models.knowledge_base import KnowledgeBase


@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, document_id: str, object_name: str, kb_id: str, org_id: str):
    db = SessionLocal()
    temp_file_path = None
    
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = DocStatus.PROCESSING
        db.commit()
        
        storage = MinioStorageService(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET,
            secure=settings.MINIO_SECURE
        )
        
        temp_file_path = f"/tmp/{document_id}_{doc.filename}"
        storage.download_file(object_name, temp_file_path)
        
        processor = DocumentProcessor(
            chunk_size=settings.DOCUMENT_CHUNK_SIZE,
            chunk_overlap=settings.DOCUMENT_CHUNK_OVERLAP
        )
        chunks = processor.process(temp_file_path, metadata={"doc_id": document_id})
        
        embedding_service = BGEEmbeddingService(model_path=settings.BGE_MODEL_PATH)
        texts = [c["content"] for c in chunks]
        embeddings = embedding_service.embed_batch(texts)
        
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]
            chunk["doc_id"] = document_id
        
        vector_store = MilvusVectorStore(
            host=settings.MILVUS_HOST,
            port=settings.MILVUS_PORT,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.insert_chunks(kb_id, chunks)
        
        doc.status = DocStatus.COMPLETED
        doc.chunk_count = len(chunks)
        
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        kb.document_count += 1
        kb.total_chunks += len(chunks)
        
        db.commit()
        return {"document_id": document_id, "chunks_processed": len(chunks)}
        
    except Exception as exc:
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = DocStatus.FAILED
        doc.error_message = str(exc)
        db.commit()
        raise self.retry(exc=exc, countdown=60)
        
    finally:
        db.close()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
```


---

### 1.6 API路由实现

#### 1.6.1 知识库API (app/api/knowledge_bases.py)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.services.rag.vector_store import MilvusVectorStore
from app.core.config import settings

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
    
    vector_store = MilvusVectorStore(
        host=settings.MILVUS_HOST,
        port=settings.MILVUS_PORT,
        dim=settings.EMBEDDING_DIMENSION
    )
    vector_store.create_collection(kb.id)
    return kb


@router.get("", response_model=List[KnowledgeBaseResponse])
async def list_kbs(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return db.query(KnowledgeBase).filter(
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status == KBStatus.ACTIVE
    ).all()


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_kb(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


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
    
    vector_store = MilvusVectorStore(host=settings.MILVUS_HOST, port=settings.MILVUS_PORT)
    vector_store.delete_collection(kb_id)
    return None
```

#### 1.6.2 文档API (app/api/documents.py)

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.document import Document, DocStatus
from app.models.knowledge_base import KnowledgeBase
from app.schemas.document import DocumentUploadResponse, DocumentResponse
from app.services.storage.minio_client import MinioStorageService
from app.celery_tasks.document_tasks import process_document_task
from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["documents"])


@router.post("/knowledge-bases/{kb_id}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    storage = MinioStorageService(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        bucket=settings.MINIO_BUCKET,
        secure=settings.MINIO_SECURE
    )
    
    object_name = storage.upload_file(file.file, file.filename, user.org_id)
    
    doc = Document(
        kb_id=kb_id,
        org_id=user.org_id,
        filename=file.filename,
        file_size=0,
        file_type=file.filename.split(".")[-1].lower(),
        storage_path=object_name,
        status=DocStatus.PENDING
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    process_document_task.delay(doc.id, object_name, kb_id, user.org_id)
    
    return DocumentUploadResponse(
        id=doc.id,
        filename=doc.filename,
        file_size=doc.file_size,
        file_type=doc.file_type,
        status=doc.status.value
    )


@router.get("/knowledge-bases/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return db.query(Document).filter(
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).all()


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == user.org_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == user.org_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    storage = MinioStorageService(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        bucket=settings.MINIO_BUCKET,
        secure=settings.MINIO_SECURE
    )
    storage.delete_file(doc.storage_path)
    
    from app.services.rag.vector_store import MilvusVectorStore
    vector_store = MilvusVectorStore(host=settings.MILVUS_HOST, port=settings.MILVUS_PORT)
    vector_store.delete_by_doc_id(doc.kb_id, doc_id)
    
    db.delete(doc)
    db.commit()
    return None
```

#### 1.6.3 对话API (app/api/chat.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.chat import ChatSession, ChatMessage, MessageRole
from app.models.knowledge_base import KnowledgeBase
from app.schemas.chat import ChatSessionCreate, ChatSessionResponse, ChatMessageRequest, ChatMessageResponse
from app.services.rag.embedding_service import BGEEmbeddingService
from app.services.rag.vector_store import MilvusVectorStore
from app.services.rag.llm_service import KimiLLMService
from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/knowledge-bases/{kb_id}/chat-sessions", response_model=ChatSessionResponse)
async def create_session(
    kb_id: str,
    data: ChatSessionCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    session = ChatSession(
        kb_id=kb_id,
        org_id=user.org_id,
        created_by=user.id,
        title=data.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/knowledge-bases/{kb_id}/chat-sessions", response_model=List[ChatSessionResponse])
async def list_sessions(kb_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return db.query(ChatSession).filter(
        ChatSession.kb_id == kb_id,
        ChatSession.org_id == user.org_id
    ).order_by(ChatSession.created_at.desc()).all()


@router.get("/chat-sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_messages(session_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return messages


@router.post("/knowledge-bases/{kb_id}/chat")
async def chat_stream(
    kb_id: str,
    request: ChatMessageRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    session_id = request.session_id
    if not session_id:
        session = ChatSession(kb_id=kb_id, org_id=user.org_id, created_by=user.id)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    
    user_msg = ChatMessage(
        session_id=session_id,
        role=MessageRole.USER,
        content=request.message
    )
    db.add(user_msg)
    db.commit()
    
    async def event_generator():
        embedding_service = BGEEmbeddingService(model_path=settings.BGE_MODEL_PATH)
        query_embedding = embedding_service.embed_query(request.message)
        
        vector_store = MilvusVectorStore(
            host=settings.MILVUS_HOST,
            port=settings.MILVUS_PORT,
            dim=settings.EMBEDDING_DIMENSION
        )
        contexts = vector_store.search(
            kb_id,
            query_embedding,
            top_k=settings.RETRIEVAL_TOP_K,
            score_threshold=settings.RETRIEVAL_SCORE_THRESHOLD
        )
        
        sources = [{
            "doc_id": c["doc_id"],
            "content": c["content"][:200] + "...",
            "score": c["score"],
            "metadata": c["metadata"]
        } for c in contexts]
        
        yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"
        
        llm = KimiLLMService(
            api_key=settings.KIMI_API_KEY,
            base_url=settings.KIMI_BASE_URL
        )
        
        full_answer = ""
        async for chunk in llm.generate_stream(request.message, contexts):
            full_answer += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'data': chunk})}\n\n"
        
        ai_msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.ASSISTANT,
            content=full_answer,
            sources=sources
        )
        db.add(ai_msg)
        db.commit()
        
        yield f"data: {json.dumps({'type': 'done', 'data': {'session_id': session_id, 'content': full_answer}})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

### 1.7 配置文件更新

#### 1.7.1 核心配置 (app/core/config.py)

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
    
    # Milvus配置
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: str = "19530"
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
    MAX_FILE_SIZE: str = "50MB"
    
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

#### 1.7.2 主应用入口更新 (app/main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import tasks, webhooks, knowledge_bases, documents, chat

# 创建所有数据库表
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

# 注册路由
app.include_router(tasks.router)
app.include_router(webhooks.router)
app.include_router(knowledge_bases.router)
app.include_router(documents.router)
app.include_router(chat.router)
```


---

## 第二部分：前端开发

### 2.1 项目结构

```
frontend/src/
├── components/
│   ├── knowledge-base/
│   │   ├── KBList.tsx           # 知识库列表组件
│   │   ├── KBForm.tsx           # 知识库创建/编辑表单
│   │   ├── KBDetail.tsx         # 知识库详情
│   │   └── DocumentList.tsx     # 文档列表
│   ├── chat/
│   │   ├── ChatInterface.tsx    # 聊天主界面
│   │   ├── ChatMessage.tsx      # 单条消息组件
│   │   ├── ChatInput.tsx        # 输入框组件
│   │   └── SourceCitation.tsx   # 引用来源组件
│   └── common/
│       ├── Sidebar.tsx          # 侧边栏
│       └── Header.tsx           # 顶部导航
├── hooks/
│   ├── useKnowledgeBases.ts     # 知识库相关hook
│   ├── useDocuments.ts          # 文档相关hook
│   └── useChat.ts               # 聊天相关hook
├── pages/
│   ├── KnowledgeBasesPage.tsx   # 知识库列表页
│   ├── KnowledgeBasePage.tsx    # 知识库详情页
│   └── ChatPage.tsx             # 聊天页
├── services/
│   └── api.ts                   # API调用封装
└── types/
    └── index.ts                 # TypeScript类型定义
```

---

### 2.2 类型定义 (src/types/index.ts)

```typescript
// 知识库类型
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  org_id: string;
  created_by: string;
  status: 'active' | 'disabled' | 'deleted';
  document_count: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface CreateKBRequest {
  name: string;
  description?: string;
}

// 文档类型
export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunk_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadDocumentResponse {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  status: string;
  message: string;
}

// 对话类型
export interface ChatSession {
  id: string;
  kb_id: string;
  title?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceItem[];
  created_at: string;
}

export interface SourceItem {
  doc_id: string;
  doc_name?: string;
  content: string;
  score: number;
  chunk_index?: number;
}

export interface SendMessageRequest {
  message: string;
  session_id?: string;
}

export interface StreamChunk {
  type: 'sources' | 'chunk' | 'done' | 'error';
  data: any;
}
```

---

### 2.3 API服务封装 (src/services/api.ts)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await window.Clerk?.session?.getToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // 知识库API
  async getKnowledgeBases() {
    return this.request<KnowledgeBase[]>('/api/v1/knowledge-bases');
  }

  async createKnowledgeBase(data: CreateKBRequest) {
    return this.request<KnowledgeBase>('/api/v1/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteKnowledgeBase(id: string) {
    return this.request<void>(`/api/v1/knowledge-bases/${id}`, {
      method: 'DELETE',
    });
  }

  // 文档API
  async getDocuments(kbId: string) {
    return this.request<Document[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
  }

  async uploadDocument(kbId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = await window.Clerk?.session?.getToken();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/knowledge-bases/${kbId}/documents`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json() as Promise<UploadDocumentResponse>;
  }

  async deleteDocument(docId: string) {
    return this.request<void>(`/api/v1/documents/${docId}`, {
      method: 'DELETE',
    });
  }

  // 对话API
  async getChatSessions(kbId: string) {
    return this.request<ChatSession[]>(`/api/v1/knowledge-bases/${kbId}/chat-sessions`);
  }

  async createChatSession(kbId: string, title?: string) {
    return this.request<ChatSession>(`/api/v1/knowledge-bases/${kbId}/chat-sessions`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async getMessages(sessionId: string) {
    return this.request<ChatMessage[]>(`/api/v1/chat-sessions/${sessionId}/messages`);
  }

  // SSE流式聊天
  async *sendMessageStream(kbId: string, message: string, sessionId?: string): AsyncGenerator<StreamChunk> {
    const token = await window.Clerk?.session?.getToken();
    const response = await fetch(`${API_BASE_URL}/api/v1/knowledge-bases/${kbId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
      throw new Error('Chat request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data as StreamChunk;
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  }
}

export const api = new ApiService();
```

---

### 2.4 React Hooks

#### 2.4.1 知识库Hook (src/hooks/useKnowledgeBases.ts)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { KnowledgeBase, CreateKBRequest } from '../types';

export function useKnowledgeBases() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getKnowledgeBases();
      setKnowledgeBases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const createKnowledgeBase = useCallback(async (data: CreateKBRequest) => {
    setLoading(true);
    try {
      const newKB = await api.createKnowledgeBase(data);
      setKnowledgeBases((prev) => [...prev, newKB]);
      return newKB;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteKnowledgeBase = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await api.deleteKnowledgeBase(id);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  return {
    knowledgeBases,
    loading,
    error,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
  };
}
```

#### 2.4.2 文档Hook (src/hooks/useDocuments.ts)

```typescript
import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type { Document, UploadDocumentResponse } from '../types';

export function useDocuments(kbId: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDocuments(kbId);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  const uploadDocument = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const response = await api.uploadDocument(kbId, file);
      // 添加新文档到列表（状态为pending）
      const newDoc: Document = {
        id: response.id,
        kb_id: kbId,
        filename: response.filename,
        file_size: response.file_size,
        file_type: response.file_type,
        status: 'pending',
        chunk_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  const deleteDocument = useCallback(async (docId: string) => {
    setLoading(true);
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  };
}
```

#### 2.4.3 聊天Hook (src/hooks/useChat.ts)

```typescript
import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type { ChatMessage, ChatSession, SourceItem } from '../types';

export function useChat(kbId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.getChatSessions(kbId);
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [kbId]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    try {
      const data = await api.getMessages(sessionId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    try {
      const session = await api.createChatSession(kbId, title);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setMessages([]);
      return session;
    } catch (err) {
      console.error('Failed to create session:', err);
      throw err;
    }
  }, [kbId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setLoading(true);
    setStreaming(true);

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      session_id: currentSessionId || '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 添加AI消息占位
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        session_id: currentSessionId || '',
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      let sessionId = currentSessionId;
      let sources: SourceItem[] = [];
      let fullContent = '';

      for await (const chunk of api.sendMessageStream(kbId, content, sessionId || undefined)) {
        if (chunk.type === 'sources') {
          sources = chunk.data;
        } else if (chunk.type === 'chunk') {
          fullContent += chunk.data;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, content: fullContent } : msg
            )
          );
        } else if (chunk.type === 'done') {
          if (chunk.data.session_id && !sessionId) {
            sessionId = chunk.data.session_id;
            setCurrentSessionId(sessionId);
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: fullContent, sources }
                : msg
            )
          );
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, content: '抱歉，发生了错误，请重试。' }
            : msg
        )
      );
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [kbId, currentSessionId]);

  return {
    messages,
    sessions,
    currentSessionId,
    loading,
    streaming,
    fetchSessions,
    fetchMessages,
    createSession,
    sendMessage,
    setCurrentSessionId,
  };
}
```


---

### 2.5 React组件

#### 2.5.1 聊天界面组件 (src/components/chat/ChatInterface.tsx)

```tsx
import { useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatInterfaceProps {
  kbId: string;
  kbName: string;
}

export function ChatInterface({ kbId, kbName }: ChatInterfaceProps) {
  const {
    messages,
    sessions,
    currentSessionId,
    loading,
    streaming,
    fetchSessions,
    sendMessage,
    createSession,
    setCurrentSessionId,
  } = useChat(kbId);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSend = async (content: string) => {
    if (!currentSessionId) {
      await createSession(content.slice(0, 50));
    }
    await sendMessage(content);
  };

  return (
    <div className="flex h-full">
      {/* 会话列表侧边栏 */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <h3 className="font-semibold mb-4">对话历史</h3>
        <button
          onClick={() => createSession()}
          className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新建对话
        </button>
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm truncate ${
                currentSessionId === session.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-200'
              }`}
            >
              {session.title || '新对话'}
            </button>
          ))}
        </div>
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 flex flex-col">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{kbName}</h2>
          <p className="text-sm text-gray-500">基于知识库的智能问答</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">👋 开始对话</p>
              <p>输入你的问题，AI将基于知识库内容回答</p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          {streaming && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-pulse">AI正在思考...</div>
            </div>
          )}
        </div>

        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
```

#### 2.5.2 聊天消息组件 (src/components/chat/ChatMessage.tsx)

```tsx
import { SourceCitation } from './SourceCitation';
import type { ChatMessage as ChatMessageType } from '../../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitation sources={message.sources} />
        )}
        
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
```

#### 2.5.3 引用来源组件 (src/components/chat/SourceCitation.tsx)

```tsx
import { useState } from 'react';
import type { SourceItem } from '../../types';

interface SourceCitationProps {
  sources: SourceItem[];
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center text-sm text-blue-600 hover:text-blue-800"
      >
        <span>📚 参考来源 ({sources.length})</span>
        <span className="ml-1">{expanded ? '▼' : '▶'}</span>
      </button>
      
      {expanded && (
        <div className="mt-2 space-y-2">
          {sources.map((source, index) => (
            <div
              key={index}
              className="bg-white rounded p-2 text-sm border"
            >
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>来源 {index + 1}</span>
                <span>相关度: {(source.score * 100).toFixed(1)}%</span>
              </div>
              <p className="text-gray-700 line-clamp-3">{source.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 2.5.4 聊天输入组件 (src/components/chat/ChatInput.tsx)

```tsx
import { useState } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          disabled={disabled}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </form>
  );
}
```

#### 2.5.5 知识库列表组件 (src/components/knowledge-base/KBList.tsx)

```tsx
import { useKnowledgeBases } from '../../hooks/useKnowledgeBases';
import { Link } from 'react-router-dom';

export function KBList() {
  const { knowledgeBases, loading, deleteKnowledgeBase } = useKnowledgeBases();

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {knowledgeBases.map((kb) => (
        <div
          key={kb.id}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold truncate">{kb.name}</h3>
            <button
              onClick={() => deleteKnowledgeBase(kb.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              删除
            </button>
          </div>
          
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {kb.description || '暂无描述'}
          </p>
          
          <div className="flex justify-between text-sm text-gray-500 mb-4">
            <span>📄 {kb.document_count} 文档</span>
            <span>🧩 {kb.total_chunks} 片段</span>
          </div>
          
          <div className="flex space-x-2">
            <Link
              to={`/knowledge-bases/${kb.id}`}
              className="flex-1 text-center px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              管理
            </Link>
            <Link
              to={`/knowledge-bases/${kb.id}/chat`}
              className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              对话
            </Link>
          </div>
        </div>
      ))}
      
      {knowledgeBases.length === 0 && (
        <div className="col-span-full text-center py-20 text-gray-500">
          <p className="text-lg mb-2">还没有知识库</p>
          <p>点击上方按钮创建第一个知识库</p>
        </div>
      )}
    </div>
  );
}
```

#### 2.5.6 文档列表组件 (src/components/knowledge-base/DocumentList.tsx)

```tsx
import { useEffect, useState } from 'react';
import { useDocuments } from '../../hooks/useDocuments';

interface DocumentListProps {
  kbId: string;
}

export function DocumentList({ kbId }: DocumentListProps) {
  const { documents, loading, fetchDocuments, uploadDocument, deleteDocument } =
    useDocuments(kbId);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocument(file);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700">
          {uploading ? '上传中...' : '上传文档'}
          <input
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
            accept=".txt,.md,.pdf,.docx"
          />
        </label>
        <span className="ml-4 text-sm text-gray-500">
          支持: TXT, MD, PDF, DOCX
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  文件名
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  片段数
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  上传时间
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 text-sm">{doc.filename}</td>
                  <td className="px-4 py-3">{getStatusBadge(doc.status)}</td>
                  <td className="px-4 py-3 text-sm">{doc.chunk_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {documents.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              暂无文档，请上传
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### 2.6 页面组件

#### 2.6.1 知识库列表页 (src/pages/KnowledgeBasesPage.tsx)

```tsx
import { useState } from 'react';
import { KBList } from '../components/knowledge-base/KBList';
import { KBForm } from '../components/knowledge-base/KBForm';

export function KnowledgeBasesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">我的知识库</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 新建知识库
        </button>
      </div>

      <KBList />

      {showForm && <KBForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
```

#### 2.6.2 知识库详情页 (src/pages/KnowledgeBasePage.tsx)

```tsx
import { useParams, Link } from 'react-router-dom';
import { DocumentList } from '../components/knowledge-base/DocumentList';

export function KnowledgeBasePage() {
  const { kbId } = useParams<{ kbId: string }>();

  if (!kbId) return <div>知识库ID不存在</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link to="/knowledge-bases" className="text-blue-600 hover:underline">
          ← 返回列表
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">知识库文档</h1>
        <Link
          to={`/knowledge-bases/${kbId}/chat`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          开始对话
        </Link>
      </div>

      <DocumentList kbId={kbId} />
    </div>
  );
}
```

#### 2.6.3 聊天页 (src/pages/ChatPage.tsx)

```tsx
import { useParams, Link } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { useKnowledgeBases } from '../hooks/useKnowledgeBases';

export function ChatPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const { knowledgeBases } = useKnowledgeBases();
  
  const kb = knowledgeBases.find((k) => k.id === kbId);

  if (!kbId) return <div>知识库ID不存在</div>;

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b px-6 py-3 flex items-center space-x-4">
        <Link to="/knowledge-bases" className="text-blue-600 hover:underline">
          ← 返回
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          to={`/knowledge-bases/${kbId}`}
          className="text-blue-600 hover:underline"
        >
          管理文档
        </Link>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ChatInterface kbId={kbId} kbName={kb?.name || '知识库'} />
      </div>
    </div>
  );
}
```

---

### 2.7 路由配置更新 (src/App.tsx)

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { KnowledgeBasesPage } from './pages/KnowledgeBasesPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { ChatPage } from './pages/ChatPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/knowledge-bases"
          element={
            <>
              <SignedIn>
                <KnowledgeBasesPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/knowledge-bases/:kbId"
          element={
            <>
              <SignedIn>
                <KnowledgeBasePage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
        <Route
          path="/knowledge-bases/:kbId/chat"
          element={
            <>
              <SignedIn>
                <ChatPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
        <Route path="*" element={<KnowledgeBasesPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## 第三部分：部署与运行

### 3.1 启动依赖服务

```bash
# 启动Milvus、Redis、MinIO
docker-compose up -d

# 检查服务状态
docker-compose ps
```

### 3.2 后端启动

```bash
cd backend

# 安装依赖
uv pip install -e .

# 启动Celery Worker
celery -A app.celery_tasks.celery_app worker --loglevel=info

# 启动FastAPI服务（新终端）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3.3 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 3.4 访问应用

- 前端: http://localhost:5173
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs

---

## 附录：完整文件清单

### 后端新增文件

| 文件路径 | 说明 |
|---------|------|
| `app/models/knowledge_base.py` | 知识库模型 |
| `app/models/document.py` | 文档模型 |
| `app/models/chat.py` | 对话模型 |
| `app/schemas/knowledge_base.py` | 知识库Schema |
| `app/schemas/document.py` | 文档Schema |
| `app/schemas/chat.py` | 对话Schema |
| `app/services/rag/vector_store.py` | Milvus向量存储服务 |
| `app/services/rag/embedding_service.py` | BGE Embedding服务 |
| `app/services/rag/llm_service.py` | Kimi LLM服务 |
| `app/services/rag/document_processor.py` | 文档处理服务 |
| `app/services/storage/minio_client.py` | MinIO存储服务 |
| `app/celery_tasks/celery_app.py` | Celery配置 |
| `app/celery_tasks/document_tasks.py` | 文档处理任务 |
| `app/api/knowledge_bases.py` | 知识库API路由 |
| `app/api/documents.py` | 文档API路由 |
| `app/api/chat.py` | 对话API路由 |
| `docker-compose.yml` | Docker Compose配置 |

### 前端新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/types/index.ts` | TypeScript类型定义 |
| `src/services/api.ts` | API服务封装 |
| `src/hooks/useKnowledgeBases.ts` | 知识库Hook |
| `src/hooks/useDocuments.ts` | 文档Hook |
| `src/hooks/useChat.ts` | 聊天Hook |
| `src/components/knowledge-base/KBList.tsx` | 知识库列表 |
| `src/components/knowledge-base/KBForm.tsx` | 知识库表单 |
| `src/components/knowledge-base/DocumentList.tsx` | 文档列表 |
| `src/components/chat/ChatInterface.tsx` | 聊天界面 |
| `src/components/chat/ChatMessage.tsx` | 聊天消息 |
| `src/components/chat/ChatInput.tsx` | 聊天输入 |
| `src/components/chat/SourceCitation.tsx` | 引用来源 |
| `src/pages/KnowledgeBasesPage.tsx` | 知识库列表页 |
| `src/pages/KnowledgeBasePage.tsx` | 知识库详情页 |
| `src/pages/ChatPage.tsx` | 聊天页 |

---

*文档版本: v1.0*
*项目名称: KnowHub*
*创建时间: 2025-04-10*
