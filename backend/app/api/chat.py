from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user, AuthUser
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
    user: AuthUser = Depends(get_current_user)
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
        created_by=user.user_id,
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
    user: AuthUser = Depends(get_current_user)
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
            created_by=user.user_id,
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
    user: AuthUser = Depends(get_current_user)
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
