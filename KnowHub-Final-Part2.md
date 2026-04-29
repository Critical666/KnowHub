# KnowHub - 企业RAG知识库SaaS 完整开发文档（Part 2：Phase 4-7）

本文档是 KnowHub-Final-Part1.md 的续篇，包含 Phase 4-7 的完整代码实现。

---

## 第五章：Phase 4 - 文档解析与向量化

### 5.1 目标

实现文档的异步处理流程，包括文档解析、文本分段、Embedding生成、向量存储。

### 5.2 交付物

- `backend/app/services/rag/document_processor.py`
- `backend/app/services/rag/embedding_service.py`
- `backend/app/celery_tasks/celery_app.py`
- `backend/app/celery_tasks/document_tasks.py`

### 5.3 实现步骤

**文件**：`backend/app/services/rag/document_processor.py`

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
        if ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        elif ext == '.docx':
            from docx import Document
            doc = Document(file_path)
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return f"[Document content from {ext} file]"
```

**文件**：`backend/app/services/rag/embedding_service.py`

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

**文件**：`backend/app/celery_tasks/celery_app.py`

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

**文件**：`backend/app/celery_tasks/document_tasks.py`

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
            db_path=settings.MILVUS_LITE_PATH,
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

## 第六章：Phase 5 - RAG问答功能

### 6.1 目标

实现智能问答功能。

### 6.2 交付物

- `backend/app/services/rag/llm_service.py`
- `backend/app/schemas/chat.py`
- `backend/app/api/chat.py`

### 6.3 实现步骤

**文件**：`backend/app/services/rag/llm_service.py`

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

**文件**：`backend/app/schemas/chat.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ChatSessionResponse(BaseModel):
    id: str
    kb_id: str
    title: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = Field(None)


class SourceItem(BaseModel):
    doc_id: str
    doc_name: Optional[str] = None
    content: str
    score: float
    chunk_index: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[List[SourceItem]]
    created_at: datetime
```

**文件**：`backend/app/api/chat.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.chat import ChatSession, ChatMessage, MessageRole
from app.models.knowledge_base import KnowledgeBase
from app.schemas.chat import (
    ChatSessionCreate, ChatSessionResponse,
    ChatMessageRequest, ChatMessageResponse, SourceItem
)
from app.services.rag.vector_store import MilvusVectorStore
from app.services.rag.embedding_service import BGEEmbeddingService
from app.services.rag.llm_service import KimiLLMService

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
        title=data.title or "新对话"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/knowledge-bases/{kb_id}/chat", response_model=ChatMessageResponse)
async def chat(
    kb_id: str,
    data: ChatMessageRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    if data.session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == data.session_id,
            ChatSession.org_id == user.org_id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(
            kb_id=kb_id,
            org_id=user.org_id,
            created_by=user.id,
            title=data.message[:20] + "..."
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    
    user_message = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content=data.message
    )
    db.add(user_message)
    db.commit()
    
    embedding_service = BGEEmbeddingService(model_path=settings.BGE_MODEL_PATH)
    query_embedding = embedding_service.embed_query(data.message)
    
    vector_store = MilvusVectorStore(
        db_path=settings.MILVUS_LITE_PATH,
        dim=settings.EMBEDDING_DIMENSION
    )
    contexts = vector_store.search(
        kb_id=kb_id,
        query_embedding=query_embedding,
        top_k=settings.RETRIEVAL_TOP_K,
        score_threshold=settings.RETRIEVAL_SCORE_THRESHOLD
    )
    
    llm_service = KimiLLMService(
        api_key=settings.KIMI_API_KEY,
        base_url=settings.KIMI_BASE_URL
    )
    
    response_text = ""
    async for chunk in llm_service.generate_stream(data.message, contexts):
        response_text += chunk
    
    sources = [
        SourceItem(
            doc_id=ctx["doc_id"],
            content=ctx["content"],
            score=ctx["score"],
            chunk_index=ctx.get("chunk_index")
        ) for ctx in contexts
    ]
    
    assistant_message = ChatMessage(
        session_id=session.id,
        role=MessageRole.ASSISTANT,
        content=response_text,
        sources=[s.dict() for s in sources]
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    return ChatMessageResponse(
        id=assistant_message.id,
        session_id=session.id,
        role=assistant_message.role.value,
        content=assistant_message.content,
        sources=sources,
        created_at=assistant_message.created_at
    )


@router.get("/chat-sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_messages(
    session_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.org_id == user.org_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at).all()
    
    return [
        ChatMessageResponse(
            id=m.id,
            session_id=m.session_id,
            role=m.role.value,
            content=m.content,
            sources=[SourceItem(**s) for s in m.sources] if m.sources else None,
            created_at=m.created_at
        ) for m in messages
    ]
```

---

## 第七章：Phase 6 - 前端界面开发

### 7.1 目标

实现用户界面。

### 7.2 交付物

- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/KnowledgeBaseList.tsx`
- `frontend/src/components/ChatInterface.tsx`

### 7.3 实现步骤

**文件**：`frontend/package.json`

```json
{
  "name": "knowhub-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@clerk/clerk-react": "^4.28.0",
    "axios": "^1.6.0",
    "antd": "^5.12.0",
    "@ant-design/icons": "^5.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**文件**：`frontend/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
```

**文件**：`frontend/src/App.tsx`

```tsx
import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { Layout } from 'antd'
import KnowledgeBaseList from './components/KnowledgeBaseList'
import ChatInterface from './components/ChatInterface'

const { Header, Content } = Layout

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: 'white' }}>
        <h1>KnowHub - 企业知识库</h1>
      </Header>
      <Content style={{ padding: '24px' }}>
        <SignedOut>
          <div style={{ maxWidth: 400, margin: '100px auto' }}>
            <SignIn />
          </div>
        </SignedOut>
        <SignedIn>
          <Routes>
            <Route path="/" element={<KnowledgeBaseList />} />
            <Route path="/kb/:kbId/chat" element={<ChatInterface />} />
          </Routes>
        </SignedIn>
      </Content>
    </Layout>
  )
}

export default App
```

**文件**：`frontend/src/components/KnowledgeBaseList.tsx`

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { List, Card, Button, Modal, Form, Input, message } from 'antd'
import { PlusOutlined, MessageOutlined } from '@ant-design/icons'
import axios from 'axios'

interface KnowledgeBase {
  id: string
  name: string
  description: string
  document_count: number
}

const API_BASE = 'http://localhost:8000/api/v1'

export default function KnowledgeBaseList() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchKnowledgeBases()
  }, [])

  const fetchKnowledgeBases = async () => {
    try {
      const token = await getToken()
      const response = await axios.get(`${API_BASE}/knowledge-bases`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setKbs(response.data.items)
    } catch (error) {
      message.error('获取知识库列表失败')
    }
  }

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      const token = await getToken()
      await axios.post(`${API_BASE}/knowledge-bases`, values, {
        headers: { Authorization: `Bearer ${token}` }
      })
      message.success('创建成功')
      setIsModalOpen(false)
      form.resetFields()
      fetchKnowledgeBases()
    } catch (error) {
      message.error('创建失败')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          新建知识库
        </Button>
      </div>
      
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={kbs}
        renderItem={(kb) => (
          <List.Item>
            <Card
              title={kb.name}
              actions={[
                <Button icon={<MessageOutlined />} onClick={() => navigate(`/kb/${kb.id}/chat`)}>
                  对话
                </Button>
              ]}
            >
              <p>{kb.description}</p>
              <p>文档数: {kb.document_count}</p>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title="新建知识库"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

**文件**：`frontend/src/components/ChatInterface.tsx`

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Input, Button, List, Card, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import axios from 'axios'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const API_BASE = 'http://localhost:8000/api/v1'

export default function ChatInterface() {
  const { kbId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { getToken } = useAuth()

  const handleSend = async () => {
    if (!input.trim()) return
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const token = await getToken()
      const response = await axios.post(
        `${API_BASE}/knowledge-bases/${kbId}/chat`,
        { message: input },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMessages(prev => [...prev, {
        id: response.data.id,
        role: 'assistant',
        content: response.data.content
      }])
    } catch (error) {
      message.error('发送消息失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
        <List
          dataSource={messages}
          renderItem={(msg) => (
            <List.Item style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%',
                padding: '12px',
                borderRadius: '8px',
                background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                color: msg.role === 'user' ? 'white' : 'black'
              }}>
                {msg.content}
              </div>
            </List.Item>
          )}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>
          发送
        </Button>
      </div>
    </Card>
  )
}
```

---

## 第八章：Phase 7 - 集成测试与优化

### 8.1 目标

完成端到端测试，优化性能，编写部署文档。

### 8.2 启动命令汇总

```bash
# 1. 启动基础设施
cd /root/B2B-SaaS
docker-compose up -d

# 2. 启动Celery Worker
cd backend
uv run celery -A app.celery_tasks.celery_app worker --loglevel=info

# 3. 启动后端API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. 启动前端
cd frontend
npm run dev
```

### 8.3 最终项目结构

```
/root/B2B-SaaS/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── knowledge_bases.py
│   │   │   ├── documents.py
│   │   │   └── chat.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── knowledge_base.py
│   │   │   ├── document.py
│   │   │   ├── chat.py
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── knowledge_base.py
│   │   │   ├── document.py
│   │   │   └── chat.py
│   │   ├── services/
│   │   │   ├── rag/
│   │   │   │   ├── vector_store.py
│   │   │   │   ├── embedding_service.py
│   │   │   │   ├── llm_service.py
│   │   │   │   └── document_processor.py
│   │   │   └── storage/
│   │   │       └── minio_client.py
│   │   ├── celery_tasks/
│   │   │   ├── celery_app.py
│   │   │   └── document_tasks.py
│   │   └── main.py
│   ├── pyproject.toml
│   └── .env
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       └── components/
│           ├── KnowledgeBaseList.tsx
│           └── ChatInterface.tsx
└── volumes/
    ├── redis/
    ├── minio/
    └── milvus_data/
```

---

*文档版本: v4.0 (完整版)*  
*技术方案: Milvus Lite*  
*更新: 2026-04-15*
