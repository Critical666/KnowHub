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
    
    # 检查知识库是否有文档
    if kb.total_chunks == 0:
        # 知识库为空，返回友好提示
        response_text = "该知识库暂无文档。请先上传文档到知识库，然后再进行对话。"
        sources = []
    else:
        try:
            embedding_service = BGEEmbeddingService(model_path=settings.BGE_MODEL_PATH)
            query_embedding = embedding_service.embed_query(data.message)
            
            vector_store = MilvusVectorStore(
                db_path=settings.MILVUS_LITE_PATH,
                dim=settings.EMBEDDING_DIMENSION
            )
            
            # 调试日志
            print(f"[DEBUG] Searching KB {kb_id}, top_k={settings.RETRIEVAL_TOP_K}, threshold={settings.RETRIEVAL_SCORE_THRESHOLD}")
            print(f"[DEBUG] Query: {data.message}")
            print(f"[DEBUG] KB total_chunks: {kb.total_chunks}")
            
            contexts = vector_store.search(
                kb_id=kb_id,
                query_embedding=query_embedding,
                query_text=data.message,  # 添加文本用于 BM25 检索
                top_k=settings.RETRIEVAL_TOP_K,
                score_threshold=settings.RETRIEVAL_SCORE_THRESHOLD
            )
            
            # 调试日志
            print(f"[DEBUG] Found {len(contexts)} contexts")
            for i, ctx in enumerate(contexts[:3]):
                print(f"[DEBUG] Context {i+1}: score={ctx.get('score', 'N/A')}, source={ctx.get('source', 'N/A')}, content={ctx.get('content', 'N/A')[:100]}...")
            
            # 检查是否找到相关上下文
            if not contexts:
                response_text = "我在知识库中没有找到与您问题相关的信息。请尝试重新表述您的问题，或上传更多相关文档。"
                sources = []
            else:
                llm_service = KimiLLMService(
                    api_key=settings.KIMI_API_KEY,
                    base_url=settings.KIMI_BASE_URL
                )
                
                # 使用同步调用避免异步生成器阻塞
                import asyncio
                response_text = ""
                try:
                    # 设置超时，防止 LLM 调用卡死
                    async def generate_with_timeout():
                        text = ""
                        async for chunk in llm_service.generate_stream(data.message, contexts):
                            text += chunk
                        return text
                    
                    response_text = await asyncio.wait_for(
                        generate_with_timeout(),
                        timeout=60.0  # 60秒超时
                    )
                except asyncio.TimeoutError:
                    response_text = "抱歉，AI 响应超时。请稍后重试。"
                except Exception as e:
                    response_text = f"AI 服务暂时不可用，请稍后重试。错误: {str(e)}"
                
                sources = [
                    SourceItem(
                        doc_id=ctx["doc_id"],
                        content=ctx["content"],
                        score=ctx["score"],
                        chunk_index=ctx.get("chunk_index")
                    ) for ctx in contexts
                ]
        except Exception as e:
            # 检索或处理出错，返回错误信息
            response_text = f"处理您的问题时出现错误: {str(e)}。请稍后重试。"
            sources = []
    
    assistant_message = ChatMessage(
        session_id=session.id,
        role=MessageRole.ASSISTANT,
        content=response_text,
        sources=[s.dict() for s in sources] if sources else None
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
